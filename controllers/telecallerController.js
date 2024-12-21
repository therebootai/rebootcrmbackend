const Telecaller = require("../models/telecallerModel");
const bcrypt = require("bcryptjs");
const generateTelecallerId = async () => {
  const telecallers = await Telecaller.find(
    {},
    { telecallerId: 1, _id: 0 }
  ).sort({
    telecallerId: 1,
  });
  const telecallerIds = telecallers.map((telecaller) =>
    parseInt(telecaller.telecallerId.replace("telecallerId", ""), 10)
  );

  let telecallerId = 1;
  for (let i = 0; i < telecallerIds.length; i++) {
    if (telecallerId < telecallerIds[i]) {
      break;
    }
    telecallerId++;
  }

  return `telecallerId${String(telecallerId).padStart(4, "0")}`;
};

// create Telecaller

exports.createTelecaller = async (req, res) => {
  try {
    const { telecallername, mobileNumber, organizationrole, password } =
      req.body;

    const telecallerId = await generateTelecallerId();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newTelecaller = new Telecaller({
      telecallerId,
      telecallername,
      mobileNumber,
      organizationrole,
      password: hashedPassword,
    });

    await newTelecaller.save();

    res
      .status(201)
      .json({ message: "Telecaller created successfully", newTelecaller });
  } catch (error) {
    console.error("Error creating Telecaller", error.message);
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

// alll telecaller fetch
exports.getTelecaller = async (req, res) => {
  try {
    const telecallers = await Telecaller.find();
    res.status(200).json(telecallers);
  } catch (error) {
    console.error("Error fetching telecallers", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Get a Telecaller by telecallerId
exports.getTelecallerById = async (req, res) => {
  try {
    const { telecallerId } = req.params;

    const telecallers = await Telecaller.findOne({
      telecallerId,
    });
    if (!telecallers) {
      return res.status(404).json({ message: "telecaller not found" });
    }

    res.status(200).json(telecallers);
  } catch (error) {
    console.error("Error fetching telecallers:", error.message);
    res.status(500).json({ message: "Error fetching telecallers", error });
  }
};

exports.deleteTelecaller = async (req, res) => {
  try {
    const { telecallerId } = req.params;
    await Telecaller.findOneAndDelete({ telecallerId });
    res.status(200).json({ message: "Telecaller deleted successfully" });
  } catch (error) {
    console.error("Error deleting telecaller", error.message);
    res.status(500).json({ error: "Server error" });
  }
};
exports.updateTelecaller = async (req, res) => {
  try {
    const { telecallerId } = req.params;
    const { telecallername, mobileNumber, organizationrole, status, password } =
      req.body;

    const telecallerUpdate = await Telecaller.findOne({ telecallerId });
    if (!telecallerUpdate) {
      return res.status(404).json({ message: "Telecaller not found" });
    }

    telecallerUpdate.telecallername =
      telecallername || telecallerUpdate.telecallername;
    telecallerUpdate.mobileNumber =
      mobileNumber || telecallerUpdate.mobileNumber;
    telecallerUpdate.organizationrole =
      organizationrole || telecallerUpdate.organizationrole;
    if (status !== undefined) {
      telecallerUpdate.status = status;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      telecallerUpdate.password = await bcrypt.hash(password, salt);
    }

    await telecallerUpdate.save();
    res
      .status(200)
      .json({ message: "Telecaller updated successfully", telecallerUpdate });
  } catch (error) {
    console.error("Error updating Telecaller:", error.message);
    res.status(500).json({ message: "Error updating Telecaller", error });
  }
};

exports.addTargetToTelecaller = async (req, res) => {
  try {
    const { telecallerId } = req.params;
    const { month, year, amount } = req.body;

    const telecaller = await Telecaller.findOne({ telecallerId });
    if (!telecaller) {
      return res.status(404).json({ message: "Telecaller not found" });
    }

    // Check if the target for the month already exists
    const targetIndex = telecaller.targets.findIndex(
      (target) => target.month === month && target.year === year
    );

    if (targetIndex !== -1) {
      // Update the existing target
      telecaller.targets[targetIndex].amount = amount;
    } else {
      // Add a new target
      telecaller.targets.push({ month, year, amount });
    }

    await telecaller.save();
    res
      .status(200)
      .json({ message: "Target updated successfully", telecaller });
  } catch (error) {
    console.error("Error updating target:", error.message);
    res.status(500).json({ message: "Error updating target", error });
  }
};
exports.updateTargetAchievement = async (req, res) => {
  try {
    const { telecallerId } = req.params;
    const { targetId, month, year, amount, achievement } = req.body;

    const telecaller = await Telecaller.findOne({ telecallerId });
    if (!telecaller) {
      return res.status(404).json({ message: "Telecaller not found" });
    }

    const target = telecaller.targets.id(targetId);
    if (!target) {
      return res.status(404).json({ message: "Target not found" });
    }

    target.month = month;
    target.year = year;
    target.amount = amount;
    target.achievement = achievement || null;

    await telecaller.save();
    res
      .status(200)
      .json({ message: "Target updated successfully", telecaller });
  } catch (error) {
    console.error("Error updating target:", error.message);
    res.status(500).json({ message: "Error updating target", error });
  }
};

exports.clearTargetsFromTelecaller = async (req, res) => {
  try {
    const { telecallerId } = req.params;

    // Find the telecaller by ID
    const telecaller = await Telecaller.findOne({ telecallerId });
    if (!telecaller) {
      return res.status(404).json({ message: "Telecaller not found" });
    }

    // Clear the entire targets array
    telecaller.targets = [];

    await telecaller.save();
    res
      .status(200)
      .json({ message: "All targets deleted successfully", telecaller });
  } catch (error) {
    console.error("Error deleting targets:", error.message);
    res.status(500).json({ message: "Error deleting targets", error });
  }
};

exports.loginTelecaller = async (req, res) => {
  const { mobileNumber, password } = req.body;

  if (!mobileNumber || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const telecaller = await Telecaller.findOne({ mobileNumber });

    if (!telecaller) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, telecaller.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: telecaller._id,
        mobileNumber: telecaller.mobileNumber,
        name: telecaller.telecallername,
      },
      process.env.SECRET_KEY,
      { expiresIn: "1h" }
    );

    res
      .status(200)
      .json({ telecaller, token, telecallername: telecaller.telecallername });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Function to assign a business to a telecaller
exports.assignBusiness = async (req, res) => {
  const { telecallerId } = req.params;
  const { category, city } = req.body;

  try {
    // Find the telecaller by ID
    const telecaller = await Telecaller.findOne({ telecallerId });

    if (!telecaller) {
      return res.status(404).json({ message: "Telecaller not found" });
    }

    // Check and add the category
    if (category) {
      const existingCategory = telecaller.assignCategories.find(
        (assign) => assign.category === category
      );
      if (!existingCategory) {
        telecaller.assignCategories.push({ category });
      }
    }

    // Check and add the city
    if (city) {
      const existingCity = telecaller.assignCities.find(
        (assign) => assign.city === city
      );
      if (!existingCity) {
        telecaller.assignCities.push({ city });
      }
    }

    // Save the updated telecaller document
    await telecaller.save();

    res.status(200).json({
      message: "Business assigned successfully",
      assignCategories: telecaller.assignCategories,
      assignCities: telecaller.assignCities,
    });
  } catch (error) {
    res.status(500).json({ message: "Error assigning business", error });
    console.error("Error assigning business", error);
  }
};

// Remove assigned business (category or city) from Telecaller, Digital Marketer, or BDE
exports.removeAssignedBusiness = async (req, res) => {
  const { telecallerId } = req.params;

  try {
    // Find the telecaller by ID
    const telecaller = await Telecaller.findOne({ telecallerId });

    // If telecaller is not found, return 404
    if (!telecaller) {
      return res.status(404).json({ message: "Telecaller not found" });
    }

    // Clear both assignCategories and assignCities arrays
    telecaller.assignCategories = [];
    telecaller.assignCities = [];

    // Save the updated telecaller
    await telecaller.save();

    res.status(200).json({
      message: "All assigned businesses and cities removed successfully",
      assignCategories: telecaller.assignCategories,
      assignCities: telecaller.assignCities,
    });
  } catch (error) {
    console.error("Error removing assigned business for telecaller:", error);
    res.status(500).json({ message: "Server error" });
  }
};
