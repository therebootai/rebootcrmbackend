// controllers/userController.js
const User = require("../models/user");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const mongoose = require("mongoose");
const generateCustomId = require("../middleware/generateCustomId");
const businessModel = require("../models/businessModel");

dotenv.config();
// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const {
      designation,
      assignCategories,
      assignCities,
      status,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    if (designation) {
      query.designation = designation;
    }

    if (assignCategories && Array.isArray(assignCategories)) {
      const categoriesArray = assignCategories.split(",").map((c) => c.trim());
      query.assignCategories = { $in: categoriesArray };
    }

    if (assignCities) {
      const citiesArray = assignCities.split(",").map((c) => c.trim());
      query.assignCities = { $in: citiesArray };
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { designation: { $regex: search, $options: "i" } },
      ];
    }

    const usersPromise = User.find(query)
      .skip(skip)
      .limit(limitNumber)
      .populate("assignCategories")
      .populate("assignCities")
      .populate("employee_ref")
      // Optional: Add sorting here, e.g., .sort({ name: 1 })
      .lean(); // .lean() makes query faster by returning plain JS objects

    // Create a promise for getting the total count of matching users
    const countPromise = User.countDocuments(query);

    // Run both promises concurrently
    const [users, totalCount] = await Promise.all([usersPromise, countPromise]);

    // 4. Calculate Pagination Metadata
    const totalPages = Math.ceil(totalCount / limitNumber);

    res.json({
      users: users,
      totalCount: totalCount,
      totalPages: totalPages,
      currentPage: pageNumber,
      pageSize: limitNumber,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserByPhone = async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required." });
    }

    const user = await User.findOne({ phone });

    if (user) {
      return res.json({ exists: true, message: "Phone number found." });
    } else {
      return res.json({ exists: false, message: "Phone number not found." });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(userId) ? userId : null },
        { userId: userId },
      ],
    })
      .populate("assignCategories")
      .populate("assignCities")
      .populate("employee_ref");
    if (user) {
      return res.json(user);
    } else {
      return res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new user
exports.createUser = async (req, res) => {
  const { name, email, phone, password, designation, employee_ref } = req.body;

  // Validate required fields
  if (!name || !phone || !password || !designation) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (designation !== "Admin" && !employee_ref) {
    return res.status(400).json({ message: "Employee reference is required" });
  }

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ message: "Email or Phone already in use" });
    }

    let userId;
    if (designation === "Admin") {
      userId = await generateCustomId(User, "userId", "Admin-");
    } else if (designation === "BDE") {
      userId = await generateCustomId(User, "userId", "BDE-");
    } else if (designation === "Telecaller") {
      userId = await generateCustomId(User, "userId", "Telecaller-");
    } else if (designation === "DigitalMarketer") {
      userId = await generateCustomId(User, "userId", "DigitalMarketer-");
    } else {
      userId = await generateCustomId(User, "userId", "HR-");
    }

    // Create new user
    const newUser = new User({
      userId,
      name,
      email,
      phone,
      password,
      designation,
      employee_ref,
    });

    const savedUser = await newUser.save();

    // Respond with the created user and token
    res.status(201).json({ user: savedUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.loginUser = async (req, res) => {
  const { emailOrPhone, password } = req.body;

  if (!emailOrPhone || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const user = await User.findOne({
      $or: [{ email: emailOrPhone }, { phone: emailOrPhone }],
    })
      .populate("assignCategories")
      .populate("assignCities")

      .populate("employee_ref");

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        password: user.password,
        name: user.name,
        userType: "user",
      },
      process.env.SECRET_KEY,
      { expiresIn: "30d" }
    );

    res.status(200).json({ user, token, name: user.name });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const otpStorage = {};

exports.sendOtp = async (req, res) => {
  try {
    let { phone, name } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const formattedPhone = phone.startsWith("91") ? phone : "91" + phone;

    if (!name) {
      const user = await User.findOne({ phone: phone });
      if (user) {
        name = user.name;
      } else {
        name = "User";
      }
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    otpStorage[formattedPhone] = {
      otp: otpCode,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    const payload = {
      "auth-key": "aa61059c453fd7b25e02a9dec860e9c4e23834a61d1d26de4b",
      "app-key": "0f71de7c-53dc-4793-9469-96356a6a2e4a",
      destination_number: formattedPhone,
      template_id: "554597174279371",
      device_id: "67599f6c1c50a6c971f41728",
      language: "en",
      variables: [name.toString(), otpCode.toString()],
    };

    const response = await axios.post(
      "https://web.wabridge.com/api/createmessage",
      payload
    );

    if (response.data.status === true) {
      return res.json({ success: true, message: "OTP sent successfully" });
    } else {
      return res
        .status(500)
        .json({ success: false, message: "Failed to send OTP" });
    }
  } catch (error) {
    console.error("Error sending OTP:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res
        .status(400)
        .json({ message: "Phone number and OTP are required" });
    }

    const formattedPhone = phone.startsWith("91") ? phone : "91" + phone;

    if (
      otpStorage[formattedPhone] &&
      otpStorage[formattedPhone].otp === otp &&
      otpStorage[formattedPhone].expiresAt > Date.now()
    ) {
      delete otpStorage[formattedPhone];
      return res.json({ success: true, message: "OTP verified successfully" });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.verifyWithOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res
        .status(400)
        .json({ message: "Phone number and OTP are required" });
    }

    const formattedPhone = phone.startsWith("91") ? phone : "91" + phone;

    // Check if OTP exists and is valid
    if (
      otpStorage[formattedPhone] &&
      otpStorage[formattedPhone].otp === otp &&
      otpStorage[formattedPhone].expiresAt > Date.now()
    ) {
      // Find user by phone number
      const user = await User.findOne({ phone: phone })
        .populate("assignCategories")
        .populate("assignCities")

        .populate("employee_ref");
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user._id.toString(), phone: user.phone, name: user.name },
        process.env.SECRET_KEY,
        { expiresIn: "30d" }
      );

      // Cleanup OTP storage after successful verification
      delete otpStorage[formattedPhone];

      return res.json({
        success: true,
        message: "OTP verified successfully, user logged in",
        token,
        user,
      });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }
  } catch (error) {
    console.error("Error verifying OTP for login:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { mobileNumber, newPassword } = req.body;

    if (!mobileNumber || !newPassword) {
      return res
        .status(400)
        .json({ message: "Mobile number and new password are required" });
    }

    const user = await User.findOne({ phone: mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.password = newPassword;
    await user.save();

    return res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const {
      password,
      assignCategories,
      assignCities,
      targets,
      apptoken,
      status,
    } = req.body;

    const user = await User.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(userId) ? userId : null },
        { userId },
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.password = password || user.password;

    if (Array.isArray(assignCategories) && assignCategories.length > 0) {
      user.assignCategories.addToSet(
        ...assignCategories.filter((id) => mongoose.Types.ObjectId.isValid(id))
      );
    }

    if (Array.isArray(assignCities) && assignCities.length > 0) {
      user.assignCities.addToSet(
        ...assignCities.filter((id) => mongoose.Types.ObjectId.isValid(id))
      );
    }

    if (Array.isArray(targets) && targets.length > 0) {
      targets.forEach((newTarget) => {
        const existingTargetIndex = user.targets.findIndex(
          (t) => t.month === newTarget.month && t.year === newTarget.year
        );

        if (existingTargetIndex !== -1) {
          // Update existing target properties
          Object.assign(user.targets[existingTargetIndex], newTarget);
        } else {
          // Add new target
          user.targets.push(newTarget);
        }
      });
      // Mark targets array as modified if you directly manipulated subdocuments like this
      user.markModified("targets");
    }

    user.apptoken = apptoken || user.apptoken;

    user.status = status !== undefined ? status : user.status;

    await user.save();

    res.status(200).json({ message: "User updated successfully", user });
  } catch (error) {
    console.error("Error updating User:", error.message);
    res.status(500).json({ message: "Error updating User", error });
  }
};

exports.getUserFilters = async (req, res) => {
  try {
    const { userId } = req.params;
    const businesses = await businessModel
      .find({
        $or: [
          { created_by: userId },
          { appoint_to: userId },
          { lead_by: userId },
        ],
      })
      .populate("city")
      .populate("category");

    // Extract unique city _ids and category _ids
    const uniqueCityIds = [
      ...new Set(
        businesses
          .map((business) => (business.city ? business.city : null))
          .filter(Boolean)
      ),
    ];
    const uniqueCategoryIds = [
      ...new Set(
        businesses
          .map((business) => (business.category ? business.category : null))
          .filter(Boolean)
      ),
    ];

    // Send the unique _ids as a proper object
    res.status(200).json({
      cities: uniqueCityIds,
      categories: uniqueCategoryIds,
    });
  } catch (error) {
    console.error("Error fetching user filters:", error);
    res.status(500).json({ message: "Error fetching user filters" });
  }
};

exports.getUserAnalytics = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { start_date, end_date } = req.query;

    const finalBusinessAndConditions = [];
    let userIdForUserAnalytics = null;
    let userData = null;
    let userAnalytics = {};

    // 1. Construct User-Specific Business Filter (if user_id is provided)
    if (user_id) {
      userIdForUserAnalytics = new mongoose.Types.ObjectId(user_id);
      userData = await User.findById(userIdForUserAnalytics);

      if (!userData) {
        return res.status(404).json({ message: "User not found." });
      }

      userAnalytics.designation = userData.designation;
      userAnalytics.userName = userData.name;
      userAnalytics.userId = userData.userId;

      const userBusinessOrConditions = [];

      if (userData.designation !== "Admin") {
        userBusinessOrConditions.push({ lead_by: userIdForUserAnalytics });
        userBusinessOrConditions.push({ appoint_to: userIdForUserAnalytics });
        if (userData.assignCategories && userData.assignCategories.length > 0) {
          userBusinessOrConditions.push({
            category: { $in: userData.assignCategories },
          });
        }
        if (userData.assignCities && userData.assignCities.length > 0) {
          userBusinessOrConditions.push({
            city: { $in: userData.assignCities },
          });
        }
      } else {
        userBusinessOrConditions.push({ category: { $exists: true } });
        userBusinessOrConditions.push({ city: { $exists: true } });
      }
      userBusinessOrConditions.push({ created_by: userIdForUserAnalytics });

      if (userBusinessOrConditions.length > 0) {
        finalBusinessAndConditions.push({ $or: userBusinessOrConditions });
      }
    }

    // 2. Construct Date Range Business Filter (if dates are provided)
    if (start_date && end_date) {
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);

      const dateOrConditions = [
        { followUpDate: { $gte: startDate, $lte: endDate } },
        { appointmentDate: { $gte: startDate, $lte: endDate } },
        { "visit_result.follow_up_date": { $gte: startDate, $lte: endDate } },
        { createdAt: { $gte: startDate, $lte: endDate } }, // Now correctly includes createdAt
      ];
      finalBusinessAndConditions.push({ $or: dateOrConditions });
    }

    // Combine all constructed conditions into the final businessMatchQuery
    let businessMatchQuery = {};
    if (finalBusinessAndConditions.length > 0) {
      businessMatchQuery = { $and: finalBusinessAndConditions };
    }

    // Aggregate Business Data
    const businessAnalyticsPipeline = [
      { $match: businessMatchQuery }, // This is the main filter applying date and user overall criteria
      {
        $facet: {
          totalBusinesses: [{ $count: "count" }], // Count of all businesses matching the main query
          followupCount: [
            {
              $match: {
                $or: [
                  { status: "Followup" },
                  { "visit_result.reason": "Followup" },
                ],
              },
            },
            { $count: "count" },
          ],
          appointmentCount: [
            { $match: { status: "Appointment Generated" } },
            { $count: "count" },
          ],
          visitCount: [{ $match: { status: "Visited" } }, { $count: "count" }],
          dealCloseCount: [
            {
              $match: {
                $or: [
                  { status: "Deal Closed" },
                  { "visit_result.reason": "Deal Closed" },
                ],
              },
            },
            { $count: "count" },
          ],
          // NEW: Specific count for businesses created by the current user
          // This will only be included in the facet if user_id is provided
          ...(userIdForUserAnalytics
            ? {
                businessesCreatedByCurrentUserCount: [
                  { $match: { created_by: userIdForUserAnalytics } },
                  { $count: "count" },
                ],
              }
            : {}),
        },
      },
      {
        $project: {
          totalBusinesses: {
            $ifNull: [{ $arrayElemAt: ["$totalBusinesses.count", 0] }, 0],
          },
          followupCount: {
            $ifNull: [{ $arrayElemAt: ["$followupCount.count", 0] }, 0],
          },
          appointmentCount: {
            $ifNull: [{ $arrayElemAt: ["$appointmentCount.count", 0] }, 0],
          },
          visitCount: {
            $ifNull: [{ $arrayElemAt: ["$visitCount.count", 0] }, 0],
          },
          dealCloseCount: {
            $ifNull: [{ $arrayElemAt: ["$dealCloseCount.count", 0] }, 0],
          },
          // Map the new specific count to the desired output key
          created_businesses_count: {
            $ifNull: [
              {
                $arrayElemAt: ["$businessesCreatedByCurrentUserCount.count", 0],
              },
              0,
            ],
          },
        },
      },
    ];

    const businessAnalyticsResult = await businessModel.aggregate(
      businessAnalyticsPipeline
    );
    const {
      totalBusinesses,
      followupCount,
      appointmentCount,
      visitCount,
      dealCloseCount,
      created_businesses_count, // This will now correctly reflect businesses created by this user
    } = businessAnalyticsResult[0] || {};

    // User specific analytics (targets, attendance)
    if (userIdForUserAnalytics && userData) {
      let totalTargetsAmount = 0;
      let totalAchievement = 0;
      let totalCollection = 0;

      if (userData.targets && userData.targets.length > 0) {
        userData.targets.forEach((target) => {
          if (target.amount) totalTargetsAmount += target.amount;
          if (target.achievement)
            totalAchievement += parseFloat(target.achievement) || 0;
          if (target.collection)
            totalCollection += parseFloat(target.collection) || 0;
        });
      }
      userAnalytics.totalTargetsAmount = totalTargetsAmount;
      userAnalytics.totalAchievement = totalAchievement;
      userAnalytics.totalCollection = totalCollection;

      let presentCount = 0;
      let absentCount = 0;
      let leaveCount = 0;
      let totalDayCount = 0;

      let filteredAttendance = userData.attendence_list;
      if (start_date && end_date) {
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        filteredAttendance = userData.attendence_list.filter((att) => {
          const attDate = new Date(att.date);
          return attDate >= startDate && attDate <= endDate;
        });
      }

      filteredAttendance.forEach((att) => {
        totalDayCount = totalDayCount + parseFloat(att.day_count);
        if (att.status === "present") presentCount++;
        else if (att.status === "absent") absentCount++;
        else if (att.status === "leave") leaveCount++;
      });

      userAnalytics.attendance = {
        present: presentCount,
        absent: absentCount,
        leave: leaveCount,
        totalDayCount,
      };
    }

    res.status(200).json({
      totalBusinesses,
      followupCount,
      appointmentCount,
      visitCount,
      dealCloseCount,
      created_businesses_count,
      ...userAnalytics,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};
