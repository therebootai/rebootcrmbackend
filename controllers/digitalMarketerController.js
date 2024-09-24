const digitalMarketer = require("../models/digitalMarketerModel");
const bcrypt = require("bcryptjs");

const generatedigitalMarketerId = async () => {
  const digitalmarketers = await digitalMarketer
    .find({}, { digitalMarketerId: 1, _id: 0 })
    .sort({
      digitalMarketerId: 1,
    });
  const digitalMarketerIds = digitalmarketers.map((digitalmarketer) =>
    parseInt(
      digitalmarketer.digitalMarketerId.replace("digitalMarketerId", ""),
      10
    )
  );

  let digitalMarketerId = 1;
  for (let i = 0; i < digitalMarketerIds.length; i++) {
    if (digitalMarketerId < digitalMarketerIds[i]) {
      break;
    }
    digitalMarketerId++;
  }

  return `digitalMarketerId${String(digitalMarketerId).padStart(4, "0")}`;
};

// create Telecaller
exports.createDigitalMarketer = async (req, res) => {
  try {
    const { digitalMarketername, mobileNumber, organizationrole, password } =
      req.body;

    const digitalMarketerId = await generatedigitalMarketerId();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newDigitalMarketer = new digitalMarketer({
      digitalMarketerId,
      digitalMarketername,
      mobileNumber,
      organizationrole,
      password: hashedPassword,
    });

    await newDigitalMarketer.save();

    res.status(201).json({
      message: "Digital Marketer created successfully",
      newDigitalMarketer,
    });
  } catch (error) {
    console.error("Error creating Digital Marketer", error.message);
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

// alll DigitalMarketer fetch
exports.getDigitalMarketer = async (req, res) => {
  try {
    const DigitalMarketer = await digitalMarketer.find();
    res.status(200).json(DigitalMarketer);
  } catch (error) {
    console.error("Error fetching Digital Marketer", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Get a DigitalMarketer by DigitalMarketerId
exports.getDigitalMarketerById = async (req, res) => {
  try {
    const { digitalMarketerId } = req.params;

    // Find lead by leadId
    const DigitalMarketer = await digitalMarketer.findOne({
      digitalMarketerId,
    });
    if (!DigitalMarketer) {
      return res.status(404).json({ message: "DigitalMarketer not found" });
    }

    res.status(200).json(DigitalMarketer);
  } catch (error) {
    console.error("Error fetching DigitalMarketer:", error.message);
    res.status(500).json({ message: "Error fetching Candidate", error });
  }
};

exports.deleteDigitalMarketer = async (req, res) => {
  try {
    const { digitalMarketerId } = req.params;
    await digitalMarketer.findOneAndDelete({ digitalMarketerId });
    res.status(200).json({ message: "Digital Marketer deleted successfully" });
  } catch (error) {
    console.error("Error deleting digital marketer", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateDigitalMarketer = async (req, res) => {
  try {
    const { digitalMarketerId } = req.params;
    const {
      digitalMarketername,
      mobileNumber,
      organizationrole,
      status,
      password,
    } = req.body;

    const digitalMarketerUpdate = await digitalMarketer.findOne({
      digitalMarketerId,
    });
    if (!digitalMarketerUpdate) {
      return res.status(404).json({ message: "Digital Marketer not found" });
    }

    digitalMarketerUpdate.digitalMarketername =
      digitalMarketername || digitalMarketerUpdate.digitalMarketername;
    digitalMarketerUpdate.mobileNumber =
      mobileNumber || digitalMarketerUpdate.mobileNumber;
    digitalMarketerUpdate.organizationrole =
      organizationrole || digitalMarketerUpdate.organizationrole;
    if (status !== undefined) {
      digitalMarketerUpdate.status = status;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      digitalMarketerUpdate.password = await bcrypt.hash(password, salt);
    }

    await digitalMarketerUpdate.save();
    res.status(200).json({
      message: "Digital Marketer updated successfully",
      digitalMarketerUpdate,
    });
  } catch (error) {
    console.error("Error updating Digital Marketer:", error.message);
    res.status(500).json({ message: "Error updating Digital Marketer", error });
  }
};

exports.addTargetToDigitalMarketer = async (req, res) => {
  try {
    const { digitalMarketerId } = req.params;
    const { month, year, amount } = req.body;

    const DigitalMarketer = await digitalMarketer.findOne({
      digitalMarketerId,
    });
    if (!DigitalMarketer) {
      return res.status(404).json({ message: "DigitalMarketer not found" });
    }

    // Check if the target for the month already exists
    const targetIndex = DigitalMarketer.targets.findIndex(
      (target) => target.month === month && target.year === year
    );

    if (targetIndex !== -1) {
      // Update the existing target
      DigitalMarketer.targets[targetIndex].amount = amount;
    } else {
      // Add a new target
      DigitalMarketer.targets.push({ month, year, amount });
    }

    await DigitalMarketer.save();
    res.status(200).json({
      message: "DigitalMarketer updated successfully",
      DigitalMarketer,
    });
  } catch (error) {
    console.error("Error updating DigitalMarketer:", error.message);
    res.status(500).json({ message: "Error updating target", error });
  }
};

exports.updateTargetAchievement = async (req, res) => {
  try {
    const { digitalMarketerId } = req.params;
    const { targetId, month, year, amount, achievement } = req.body;

    const DigitalMarketer = await digitalMarketer.findOne({
      digitalMarketerId,
    });
    if (!DigitalMarketer) {
      return res.status(404).json({ message: "Telecaller not found" });
    }

    const target = DigitalMarketer.targets.id(targetId);
    if (!target) {
      return res.status(404).json({ message: "Target not found" });
    }

    target.month = month;
    target.year = year;
    target.amount = amount;
    target.achievement = achievement || null;

    await DigitalMarketer.save();
    res
      .status(200)
      .json({ message: "Target updated successfully", DigitalMarketer });
  } catch (error) {
    console.error("Error updating target:", error.message);
    res.status(500).json({ message: "Error updating target", error });
  }
};

exports.clearTargetsFromDigitalMarketer = async (req, res) => {
  try {
    const { digitalMarketerId } = req.params;

    // Find the telecaller by ID
    const DigitalMarketer = await digitalMarketer.findOne({
      digitalMarketerId,
    });
    if (!DigitalMarketer) {
      return res.status(404).json({ message: "DigitalMarketer not found" });
    }

    // Clear the entire targets array
    DigitalMarketer.targets = [];

    await DigitalMarketer.save();
    res
      .status(200)
      .json({ message: "All targets deleted successfully", DigitalMarketer });
  } catch (error) {
    console.error("Error deleting targets:", error.message);
    res.status(500).json({ message: "Error deleting targets", error });
  }
};

exports.loginDigitalMarketer = async (req, res) => {
  const { mobileNumber, password } = req.body;

  if (!mobileNumber || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const DigitalMarketer = await digitalMarketer.findOne({ mobileNumber });

    if (!DigitalMarketer) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, DigitalMarketer.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: DigitalMarketer._id,
        mobileNumber: DigitalMarketer.mobileNumber,
        name: DigitalMarketer.digitalMarketername,
      },
      process.env.SECRET_KEY,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      DigitalMarketer,
      token,
      digitalMarketername: DigitalMarketer.digitalMarketername,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Assign a business to a Digital Marketer
exports.assignBusiness = async (req, res) => {
  const { digitalMarketerId } = req.params;
  const { category, city } = req.body;

  try {
    const DigitalMarketer = await digitalMarketer.findOne({
      digitalMarketerId,
    });

    if (!DigitalMarketer) {
      return res.status(404).json({ message: "Digital Marketer not found" });
    }

    // Check and add the category
    if (category) {
      const existingCategory = DigitalMarketer.assignCategories.find(
        (assign) => assign.category === category
      );
      if (!existingCategory) {
        DigitalMarketer.assignCategories.push({ category });
      }
    }

    // Check and add the city
    if (city) {
      const existingCity = DigitalMarketer.assignCities.find(
        (assign) => assign.city === city
      );
      if (!existingCity) {
        DigitalMarketer.assignCities.push({ city });
      }
    }

    // Save the updated digital marketer document
    await DigitalMarketer.save();

    res.status(200).json({
      message: "Business assigned successfully",
      assignCategories: DigitalMarketer.assignCategories,
      assignCities: DigitalMarketer.assignCities,
    });
  } catch (error) {
    res.status(500).json({ message: "Error assigning business", error });
    console.error("Error assigning business", error);
  }
};

// Remove assigned business (category or city) from a Digital Marketer
exports.removeAssignedBusiness = async (req, res) => {
  const { digitalMarketerId } = req.params;
  const { category, city } = req.body;

  try {
    const DigitalMarketer = await digitalMarketer.findOne({
      digitalMarketerId,
    });

    if (!DigitalMarketer) {
      return res.status(404).json({ message: "Digital Marketer not found" });
    }

    // Remove category and/or city
    if (category) {
      DigitalMarketer.assignCategories =
        DigitalMarketer.assignCategories.filter(
          (assign) => assign.category !== category
        );
    }

    if (city) {
      DigitalMarketer.assignCities = DigitalMarketer.assignCities.filter(
        (assign) => assign.city !== city
      );
    }

    await DigitalMarketer.save();

    res.status(200).json({
      message: "Assigned business removed successfully",
      assignCategories: DigitalMarketer.assignCategories,
      assignCities: DigitalMarketer.assignCities,
    });
  } catch (error) {
    console.error(
      "Error removing assigned business from Digital Marketer",
      error
    );
    res.status(500).json({ message: "Server error" });
  }
};
