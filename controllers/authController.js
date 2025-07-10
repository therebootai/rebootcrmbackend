const BDE = require("../models/bdeModel");
const Telecaller = require("../models/telecallerModel");
const DigitalMarketer = require("../models/digitalMarketerModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");

exports.login = async (req, res) => {
  const { mobileNumber, password } = req.body;

  if (!mobileNumber || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    let user = await BDE.findOne({ mobileNumber });
    if (user) {
      if (user.status === "inactive") {
        return res.status(400).json({ message: "User is deactivated" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        {
          id: user._id,
          mobileNumber: user.mobileNumber,
          name: user.bdename,
          userType: "bde",
        },
        process.env.SECRET_KEY,
        { expiresIn: "30d" }
      );

      return res.status(200).json({
        token,
        name: user.bdename,
        role: "bde",
        id: user.bdeId,
        user,
      });
    }

    user = await Telecaller.findOne({ mobileNumber });
    if (user) {
      if (user.status === "inactive") {
        return res.status(400).json({ message: "User is deactivated" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        {
          id: user._id,
          mobileNumber: user.mobileNumber,
          name: user.telecallername,
          userType: "telecaller",
        },
        process.env.SECRET_KEY,
        { expiresIn: "30d" }
      );

      return res.status(200).json({
        token,
        name: user.telecallername,
        role: "telecaller",
        id: user.telecallerId,
      });
    }

    user = await DigitalMarketer.findOne({ mobileNumber });
    if (user) {
      if (user.status === "inactive") {
        return res.status(400).json({ message: "User is deactivated" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        {
          id: user._id,
          mobileNumber: user.mobileNumber,
          name: user.digitalMarketername,
          userType: "digitalMarketer",
        },
        process.env.SECRET_KEY,
        { expiresIn: "1h" }
      );

      return res.status(200).json({
        token,
        name: user.digitalMarketername,
        role: "digitalMarketer",
        id: user.digitalMarketerId,
      });
    }

    return res.status(400).json({ message: "Invalid credentials" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const otpStorage = {};

exports.getUserByPhone = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ message: "Phone number is required." });
    }

    let user =
      (await BDE.findOne({ mobileNumber: phone })) ||
      (await Telecaller.findOne({ mobileNumber: phone })) ||
      (await DigitalMarketer.findOne({ mobileNumber: phone }));

    if (!user) {
      return res.json({ exists: false, message: "Phone number not found." });
    }

    // Check if user is inactive
    if (user.status === "inactive") {
      return res.json({
        exists: true,
        active: false,
        message: "This account is inactive. Please contact support.",
      });
    }

    return res.json({
      exists: true,
      active: true,
      message: "Phone number found.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const formattedPhone = phone.startsWith("91") ? phone : "91" + phone;

    let user =
      (await BDE.findOne({ mobileNumber: phone })) ||
      (await Telecaller.findOne({ mobileNumber: phone })) ||
      (await DigitalMarketer.findOne({ mobileNumber: phone }));

    let name = "User"; // Default name
    if (user) {
      name = user.bdename || user.telecallername || user.digitalMarketername;
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

    if (
      otpStorage[formattedPhone] &&
      otpStorage[formattedPhone].otp === otp &&
      otpStorage[formattedPhone].expiresAt > Date.now()
    ) {
      let user =
        (await BDE.findOne({ mobileNumber: phone })) ||
        (await Telecaller.findOne({ mobileNumber: phone })) ||
        (await DigitalMarketer.findOne({ mobileNumber: phone }));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const role = user.bdename
        ? "bde"
        : user.telecallername
        ? "telecaller"
        : "digitalMarketer";
      const name =
        user.bdename || user.telecallername || user.digitalMarketername;
      const id = user.bdeId || user.telecallerId || user.digitalMarketerId;

      const token = jwt.sign(
        { id: user._id.toString(), phone: user.mobileNumber, name },
        process.env.SECRET_KEY,
        { expiresIn: "30d" }
      );

      delete otpStorage[formattedPhone];

      return res.json({
        success: true,
        message: "OTP verified successfully, user logged in",
        token,
        name,
        role,
        id,
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

    let user =
      (await BDE.findOne({ mobileNumber })) ||
      (await Telecaller.findOne({ mobileNumber })) ||
      (await DigitalMarketer.findOne({ mobileNumber }));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.logout = async (req, res) => {
  try {
    // Ensure req.user and req.userType are set by your checkAuth middleware
    if (!req.user || !req.userType) {
      return res
        .status(401)
        .json({ message: "Authentication required. User not identified." });
    }

    const userId = req.user._id;
    const userType = req.userType;

    let user;
    switch (userType) {
      case "bde":
        user = await BDE.findById(userId);
        break;
      case "telecaller":
        user = await Telecaller.findById(userId);
        break;
      case "digitalMarketer":
        user = await DigitalMarketer.findById(userId);
        break;
      default:
        return res
          .status(400)
          .json({ message: "Invalid user type provided by token." });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found in database." });
    }

    res.status(200).json({
      message: "Logged out successfully. Attendance updated.",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res
      .status(500)
      .json({ message: "Internal server error. Please try again." });
  }
};

exports.checkInUser = async (req, res) => {
  try {
    if (!req.user || !req.userType) {
      return res.status(401).json({
        message: "Authentication required. User not identified.",
        success: false,
      });
    }

    // Declare userId and userType at the beginning of the try block
    const userId = req.user._id;
    const userType = req.userType;
    const now = new Date();
    const today = now.toISOString().split("T")[0]; // "YYYY-MM-DD" for comparison

    let user;
    switch (userType) {
      case "bde":
        user = await BDE.findById(userId);
        break;
      case "telecaller":
        user = await Telecaller.findById(userId);
        break;
      case "digitalMarketer":
        user = await DigitalMarketer.findById(userId);
        break;
      default:
        return res.status(400).json({
          message: "Invalid user type provided by token.",
          success: false,
        });
    }

    if (!user) {
      return res.status(404).json({
        message: "User not found in database.",
        success: false,
      });
    }

    // Check for an existing open attendance record for today
    const existingOpenAttendance = user.attendence_list.find(
      (att) =>
        att.date &&
        att.date.toISOString().split("T")[0] === today &&
        !att.exit_time // Check if exit_time is not set (implies open record)
    );

    if (existingOpenAttendance) {
      return res.status(409).json({
        // 409 Conflict indicates resource already exists/is in a state that conflicts
        message: "You are already checked in for today.",
        success: false,
        attendanceRecord: existingOpenAttendance,
      });
    }

    // Optional: Check if the user has already completed a check-in/out for today
    // If you want to allow only ONE complete attendance cycle per day.
    const existingCompletedAttendance = user.attendence_list.find(
      (att) =>
        att.date &&
        att.date.toISOString().split("T")[0] === today &&
        att.exit_time // Check if exit_time is set (implies completed record)
    );

    if (existingCompletedAttendance) {
      return res.status(409).json({
        message:
          "You have already completed your attendance for today. Multiple check-ins are not allowed.",
        success: false,
        attendanceRecord: existingCompletedAttendance,
      });
    }

    // If no existing open or completed record for today, create a new one
    const newAttendanceRecord = {
      date: now, // Store the full date for easy querying
      entry_time: now, // Store the full Date object including time
      exit_time: null, // Initialize as null or undefined, to be filled on checkout
      day_count: "0", // Default to "0", will be calculated on checkout
      status: "present", // User is now present
    };

    user.attendence_list.push(newAttendanceRecord);
    await user.save();

    res.status(200).json({
      message: "User checked in successfully.",
      attendanceRecord: newAttendanceRecord, // Return the newly created record
      success: true,
    });
  } catch (error) {
    console.error("Check-in error:", error);
    res.status(500).json({
      message: "Internal server error. Please try again.",
      success: false,
    });
  }
};

exports.checkOutUser = async (req, res) => {
  try {
    if (!req.user || !req.userType) {
      return res.status(401).json({
        message: "Authentication required. User not identified.",
        success: false, // Added for consistency
      });
    }

    const userId = req.user._id;
    const userType = req.userType;
    const now = new Date();
    const today = now.toISOString().split("T")[0]; // "YYYY-MM-DD" for comparison

    let user;
    switch (userType) {
      case "bde":
        user = await BDE.findById(userId);
        break;
      case "telecaller":
        user = await Telecaller.findById(userId);
        break;
      case "digitalMarketer":
        user = await DigitalMarketer.findById(userId);
        break;
      default:
        return res.status(400).json({
          message: "Invalid user type provided by token.",
          success: false, // Added for consistency
        });
    }

    if (!user) {
      return res.status(404).json({
        message: "User not found in database.",
        success: false,
      });
    }

    // Find the attendance record for today that has an entry_time but no exit_time
    // We iterate backwards to find the most recent check-in, though with "one check-in per day",
    // there should ideally be only one such record.
    let targetAttendanceIndex = -1;
    for (let i = user.attendence_list.length - 1; i >= 0; i--) {
      const att = user.attendence_list[i];
      // Check if it's today's record and exit_time is not set (meaning it's an open record)
      if (
        att.date &&
        att.date.toISOString().split("T")[0] === today &&
        !att.exit_time
      ) {
        targetAttendanceIndex = i;
        break; // Found the most recent open record for today
      }
    }

    if (targetAttendanceIndex === -1) {
      return res.status(400).json({
        message: "No open check-in record found for today to mark exit.",
        success: false,
      });
    }

    const attendanceRecord = user.attendence_list[targetAttendanceIndex];

    // Ensure entry_time exists before proceeding (should be present if checkInUser worked)
    if (!attendanceRecord.entry_time) {
      return res.status(500).json({
        message: "Corrupted attendance record: missing entry time.",
        success: false,
      });
    }

    // Set exit time using the current Date object
    attendanceRecord.exit_time = now;

    // --- Calculate day_count based on your specific logic ---
    const entryDateTime = new Date(attendanceRecord.entry_time); // Ensure it's a Date object
    const exitDateTime = new Date(attendanceRecord.exit_time); // Ensure it's a Date object

    // Calculate duration in milliseconds
    let durationMs = exitDateTime.getTime() - entryDateTime.getTime();

    // Handle potential overnight shifts (if entry time is late evening and exit is early morning next day)
    // This part of the logic assumes that the entry and exit are for the same *calendar day*.
    // If an overnight shift means entry is one day and exit is the *next* day,
    // your 'today' comparison will not find the entry and this logic needs re-evaluation.
    // For typical office hours, this check below might not be strictly necessary if you
    // expect check-in and check-out to always be on the same calendar date.
    if (durationMs < 0) {
      // This implies the exit time is chronologically before the entry time on the same date.
      // This usually indicates an error or a misunderstanding of timestamps.
      // If it's a genuine overnight shift, the 'today' comparison in findIndex would fail to match.
      // For simplicity and clarity, assuming same-day check-in/out for now.
      // If overnight shifts are a primary concern, you'd need to consider a different way
      // to find the 'open' record that spans days.
      console.warn(
        "Negative duration detected. Entry:",
        entryDateTime,
        "Exit:",
        exitDateTime
      );
      durationMs = 0; // Or handle as an error, or adjust logic if multi-day shifts are expected.
    }

    const durationHours = durationMs / (1000 * 60 * 60); // Convert milliseconds to hours

    // Apply the day_count logic - Refined based on common attendance policies:
    // (This is a more typical way to define full/half day based on duration,
    // rather than just entry time, but you can adjust to your specific needs)
    if (durationHours >= 8) {
      // Assuming 8 hours is a full workday
      attendanceRecord.day_count = "1";
      attendanceRecord.status = "present"; // User is present for a full day
    } else if (durationHours >= 4) {
      // Assuming 4 hours is a half workday
      attendanceRecord.day_count = "0.5";
      attendanceRecord.status = "present"; // User is present for a half day
    } else if (durationHours > 0) {
      // If worked but less than half day threshold, still mark as 0.5 or 0 based on policy
      // This case might be tricky; you might want to consider it 0.5 or 0.
      attendanceRecord.day_count = "0.5"; // Or "0" if very short duration means no count
      attendanceRecord.status = "present"; // Still present, just for short duration
    } else {
      // Duration is 0 or negative (should not happen with correct data/logic flow)
      attendanceRecord.day_count = "0";
      attendanceRecord.status = "absent"; // Consider absent if no work done after check-in
    }

    await user.save(); // Save the updated user document

    res.status(200).json({
      message: "Check out successful. Attendance updated.",
      attendanceRecord: attendanceRecord, // Return the updated record for confirmation
      success: true, // Added for consistency
    });
  } catch (error) {
    console.error("Check out error:", error);
    res.status(500).json({
      message: "Internal server error. Please try again.",
      success: false,
    });
  }
};
