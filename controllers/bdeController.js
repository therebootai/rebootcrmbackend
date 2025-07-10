const { default: mongoose } = require("mongoose");
const BDE = require("../models/bdeModel");
const bcrypt = require("bcryptjs");

const generatebdeId = async () => {
  const bdes = await BDE.find({}, { bdeId: 1, _id: 0 }).sort({
    bdeId: 1,
  });
  const bdeIds = bdes.map((bde) =>
    parseInt(bde.bdeId.split("-")[0].replace("bdeid", ""), 10)
  );

  let bdeId = 1;
  for (let i = 0; i < bdeIds.length; i++) {
    if (bdeId < bdeIds[i]) {
      break;
    }
    bdeId++;
  }

  const now = new Date();
  const date = `${String(now.getDate()).padStart(2, "0")}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}${now.getFullYear()}`;
  const time = `${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  return `bdeid${String(bdeId).padStart(4, "0")}-${date}${time}`;
};

// create Telecaller
exports.createBDE = async (req, res) => {
  try {
    const { bdename, mobileNumber, organizationrole, password, employee_ref } =
      req.body;

    const bdeId = await generatebdeId();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newBDE = new BDE({
      bdeId,
      bdename,
      mobileNumber,
      organizationrole,
      password: hashedPassword,
      employee_ref,
    });

    await newBDE.save();

    res.status(201).json({
      message: "BDE created successfully",
      newBDE,
    });
  } catch (error) {
    console.error("Error creating BDE", error.message);
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      const errorMessage =
        field === "mobileNumber"
          ? "Mobile number already exists"
          : field === "altMobileNumber"
          ? "Alternative mobile number already exists"
          : "Duplicate key error";

      res.status(400).json({ error: errorMessage });
    } else {
      res.status(500).json({ error: "Server error" });
    }
  }
};

// alll BDE fetch
exports.getBDE = async (req, res) => {
  try {
    const bdes = await BDE.find().populate("employee_ref").select("-password");
    res.status(200).json(bdes);
  } catch (error) {
    console.error("Error fetching bde", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Get a BDE by BDEId
exports.getBDEById = async (req, res) => {
  try {
    const { bdeId } = req.params;

    const bdes = await BDE.findOne({
      bdeId,
    })
      .populate("employee_ref")
      .select("-password");
    if (!bdes) {
      return res.status(404).json({ message: "BDE not found" });
    }

    res.status(200).json(bdes);
  } catch (error) {
    console.error("Error fetching BDE:", error.message);
    res.status(500).json({ message: "Error fetching BDE", error });
  }
};

exports.deleteBDE = async (req, res) => {
  try {
    const { bdeId } = req.params;
    await BDE.findOneAndDelete({ bdeId });
    res.status(200).json({ message: "BDE deleted successfully" });
  } catch (error) {
    console.error("Error deleting BDE", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateBDE = async (req, res) => {
  try {
    const { bdeId } = req.params;
    const {
      bdename,
      mobileNumber,
      organizationrole,
      status,
      password,
      created_business,
      apptoken,
    } = req.body;

    const bdeUpdate = await BDE.findOne({
      $or: [
        { bdeId },
        { _id: mongoose.Types.ObjectId.isValid(bdeId) ? bdeId : null },
      ],
    });

    if (!bdeUpdate) {
      return res.status(404).json({ message: "BDE not found" });
    }

    bdeUpdate.bdename = bdename || bdeUpdate.bdename;
    bdeUpdate.mobileNumber = mobileNumber || bdeUpdate.mobileNumber;
    bdeUpdate.organizationrole = organizationrole || bdeUpdate.organizationrole;
    bdeUpdate.apptoken = apptoken || bdeUpdate.apptoken;
    if (status !== undefined) {
      bdeUpdate.status = status;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      bdeUpdate.password = await bcrypt.hash(password, salt);
    }

    if (Array.isArray(created_business) && created_business.length > 0) {
      created_business.forEach((id) => {
        // Ensure it's a valid ObjectId and not already present to prevent duplicates
        if (
          mongoose.Types.ObjectId.isValid(id) &&
          !bdeUpdate.created_business.includes(id)
        ) {
          bdeUpdate.created_business.push(id);
        }
      });
    }

    await bdeUpdate.save();
    res.status(200).json({ message: "BDE updated successfully", bdeUpdate });
  } catch (error) {
    console.error("Error updating BDE:", error.message);
    res.status(500).json({ message: "Error updating BDE", error });
  }
};

exports.addTargetToBDE = async (req, res) => {
  try {
    const { bdeId } = req.params;
    const { month, year, amount } = req.body;

    const BDEs = await BDE.findOne({
      bdeId,
    });
    if (!BDEs) {
      return res.status(404).json({ message: "BDE not found" });
    }

    // Check if the target for the month already exists
    const targetIndex = BDEs.targets.findIndex(
      (target) => target.month === month && target.year === year
    );

    if (targetIndex !== -1) {
      // Update the existing target
      BDEs.targets[targetIndex].amount = amount;
    } else {
      // Add a new target
      BDEs.targets.push({ month, year, amount });
    }

    await BDEs.save();
    res.status(200).json({
      message: "BDE updated successfully",
      BDEs,
    });
  } catch (error) {
    console.error("Error updating BDE:", error.message);
    res.status(500).json({ message: "Error updating target", error });
  }
};

exports.updateTargetAchievement = async (req, res) => {
  try {
    const { bdeId } = req.params;
    const { targetId, month, year, amount, achievement } = req.body;

    const bdes = await BDE.findOne({
      bdeId,
    });
    if (!bdes) {
      return res.status(404).json({ message: "bdes not found" });
    }

    const target = bdes.targets.id(targetId);
    if (!target) {
      return res.status(404).json({ message: "Target not found" });
    }

    target.month = month;
    target.year = year;
    target.amount = amount;
    target.achievement = achievement || null;

    await bdes.save();
    res.status(200).json({ message: "Target updated successfully", bdes });
  } catch (error) {
    console.error("Error updating target:", error.message);
    res.status(500).json({ message: "Error updating target", error });
  }
};

exports.clearTargetsFromBDE = async (req, res) => {
  try {
    const { bdeId } = req.params;

    // Find the telecaller by ID
    const bdes = await BDE.findOne({ bdeId });
    if (!bdes) {
      return res.status(404).json({ message: "bde not found" });
    }

    // Clear the entire targets array
    bdes.targets = [];

    await bdes.save();
    res.status(200).json({ message: "All targets deleted successfully", bdes });
  } catch (error) {
    console.error("Error deleting targets:", error.message);
    res.status(500).json({ message: "Error deleting targets", error });
  }
};

// Assign a business to a BDE
exports.assignBusiness = async (req, res) => {
  const { bdeId } = req.params;
  const { category, city } = req.body;

  try {
    const bde = await BDE.findOne({ bdeId });

    if (!bde) {
      return res.status(404).json({ message: "BDE not found" });
    }

    // Check and add the category
    if (category) {
      const existingCategory = bde.assignCategories.find(
        (assign) => assign.category === category
      );
      if (!existingCategory) {
        bde.assignCategories.push({ category });
      }
    }

    // Check and add the city
    if (city) {
      const existingCity = bde.assignCities.find(
        (assign) => assign.city === city
      );
      if (!existingCity) {
        bde.assignCities.push({ city });
      }
    }

    // Save the updated BDE document
    await bde.save();

    res.status(200).json({
      message: "Business assigned successfully",
      assignCategories: bde.assignCategories,
      assignCities: bde.assignCities,
    });
  } catch (error) {
    res.status(500).json({ message: "Error assigning business", error });
    console.error("Error assigning business", error);
  }
};

// Remove assigned business (category or city) from a BDE
exports.removeAssignedBusiness = async (req, res) => {
  const { bdeId } = req.params; // Extract bdeId from request parameters

  try {
    // Find the BDE by bdeId
    const bde = await BDE.findOne({ bdeId });

    if (!bde) {
      return res.status(404).json({ message: "BDE not found" });
    }

    // Clear both assignCategories and assignCities
    bde.assignCategories = [];
    bde.assignCities = [];

    // Save the updated BDE to the database
    await bde.save();

    res.status(200).json({
      message: "Assigned categories and cities removed successfully",
      assignCategories: bde.assignCategories,
      assignCities: bde.assignCities,
    });
  } catch (error) {
    console.error("Error removing assigned business for BDE:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
