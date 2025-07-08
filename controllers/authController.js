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

      const now = new Date();
      const today = now.toISOString().split("T")[0]; // Get YYYY-MM-DD
      const entryTime = now.toLocaleTimeString("en-US", { hour12: false }); // Get HH:MM:SS

      const existingAttendanceIndex = user.attendence_list.findIndex(
        (att) => att.date && att.date.toISOString().split("T")[0] === today
      );

      if (existingAttendanceIndex === -1) {
        user.attendence_list.push({
          date: now,
          entry_time: entryTime,
          exit_time: "",
          day_count: "0",
        });
      } else {
        // If you want a new entry for each login on the same day:
        user.attendence_list.push({
          date: now,
          entry_time: entryTime,
          exit_time: "",
          day_count: "0",
        });
      }
      await user.save();

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

      const now = new Date();
      const today = now.toISOString().split("T")[0]; // Get YYYY-MM-DD
      const entryTime = now.toLocaleTimeString("en-US", { hour12: false }); // Get HH:MM:SS

      const existingAttendanceIndex = user.attendence_list.findIndex(
        (att) => att.date && att.date.toISOString().split("T")[0] === today
      );

      if (existingAttendanceIndex === -1) {
        user.attendence_list.push({
          date: now,
          entry_time: entryTime,
          exit_time: "",
          day_count: "0",
        });
      } else {
        // If you want a new entry for each login on the same day:
        user.attendence_list.push({
          date: now,
          entry_time: entryTime,
          exit_time: "",
          day_count: "0",
        });
      }
      await user.save();

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
      return res
        .status(404)
        .json({ message: "User not found in database.", success: false });
    }
    const userId = req.user._id;
    const userType = req.userType;
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const entryTime = now.toLocaleTimeString("en-US", { hour12: false });

    const existingAttendanceIndex = user.attendence_list.findIndex(
      (att) => att.date && att.date.toISOString().split("T")[0] === today
    );

    if (existingAttendanceIndex === -1) {
      user.attendence_list.push({
        date: now,
        entry_time: entryTime,
        exit_time: "",
        day_count: "0",
      });
    } else {
      user.attendence_list.push({
        date: now,
        entry_time: entryTime,
        exit_time: "",
        day_count: "0",
      });
    }
    await user.save();

    res.status(200).json({
      message: "User checked in successfully.",
      attendanceRecord: user.attendence_list[user.attendence_list.length - 1],
      success: true,
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      message: "Internal server error. Please try again.",
      success: false,
    });
  }
};

exports.checkOutUser = async (req, res) => {
  try {
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

    const now = new Date();
    const today = now.toISOString().split("T")[0]; // Get YYYY-MM-DD
    const exitTime = now.toLocaleTimeString("en-US", { hour12: false }); // Get HH:MM:SS (e.g., 15:30:00)

    // Find the most recent attendance entry for today that doesn't have an exit_time
    // We reverse to find the latest open entry for the current day
    const attendanceListCopy = [...user.attendence_list].reverse(); // Create a shallow copy to reverse
    const latestAttendanceIndexInReversed = attendanceListCopy.findIndex(
      (att) =>
        att.date &&
        att.date.toISOString().split("T")[0] === today &&
        !att.exit_time
    );

    if (latestAttendanceIndexInReversed === -1) {
      return res.status(400).json({
        message: "No open attendance record found for today to mark exit.",
      });
    }

    // Calculate the actual index in the original (non-reversed) array
    const actualIndex =
      user.attendence_list.length - 1 - latestAttendanceIndexInReversed;
    const attendanceRecord = user.attendence_list[actualIndex];

    // Ensure entry_time exists before proceeding
    if (!attendanceRecord.entry_time) {
      return res
        .status(500)
        .json({ message: "Corrupted attendance record: missing entry time." });
    }

    // Set exit time
    attendanceRecord.exit_time = exitTime;

    // --- Calculate day_count based on your specific logic ---
    const [entryHours, entryMinutes, entrySeconds] = attendanceRecord.entry_time
      .split(":")
      .map(Number);
    const [exitHours, exitMinutes, exitSeconds] = exitTime
      .split(":")
      .map(Number);

    // Create Date objects using a dummy date for time calculations
    const entryDateTime = new Date(
      2000,
      0,
      1,
      entryHours,
      entryMinutes,
      entrySeconds
    );
    let exitDateTime = new Date(
      2000,
      0,
      1,
      exitHours,
      exitMinutes,
      exitSeconds
    );

    // Handle overnight shifts: if exit time is earlier than entry time, assume it's on the next day
    if (exitDateTime < entryDateTime) {
      exitDateTime.setDate(exitDateTime.getDate() + 1);
    }

    const durationMs = exitDateTime - entryDateTime;
    const durationHours = durationMs / (1000 * 60 * 60); // Convert milliseconds to hours

    // Apply the new day_count logic
    if (entryHours >= 12) {
      // If entry time is 12 PM (noon) or later
      attendanceRecord.day_count = "0.5";
    } else if (durationHours < 8 && durationHours > 0) {
      // If duration is less than 8 hours but greater than 0
      attendanceRecord.day_count = "0.5";
    } else if (durationHours >= 8) {
      // If duration is 8 hours or more
      attendanceRecord.day_count = "1";
    } else {
      // Handle cases where duration is 0 or negative (shouldn't happen with correct logic)
      attendanceRecord.day_count = "0";
    }

    await user.save(); // Save the updated user document

    res.status(200).json({
      message: "Check out successfully. Attendance updated.",
      attendanceRecord: attendanceRecord, // Return the updated record for confirmation
    });
  } catch (error) {
    console.error("Check out error:", error);
    res.status(500).json({
      message: "Internal server error. Please try again.",
      success: false,
    });
  }
};
