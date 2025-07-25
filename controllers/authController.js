const BDE = require("../models/bdeModel");
const Telecaller = require("../models/telecallerModel");
const DigitalMarketer = require("../models/digitalMarketerModel");
const axios = require("axios");
const mongoose = require("mongoose");
const User = require("../models/user");
const { createToken } = require("../middleware/checkAuth");

exports.login = async (req, res) => {
  const { mobileNumber, password } = req.body;

  if (!mobileNumber || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const user = await User.findOne({
      $or: [{ phone: mobileNumber }, { email: mobileNumber }],
    })
      .populate("assignCategories")
      .populate("assignCities")
      .populate("employee_ref");

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user) {
      if (!user.status) {
        return res.status(400).json({ message: "User is deactivated" });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const token = createToken(user.toObject());

      return res.status(200).json({
        token,
        user,
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

    let user = User.findOne({ phone: phone });

    let name = "User";

    if (user) {
      name = user.name;
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
      const user = await User.findOne({ mobileNumber: formattedPhone });

      // 5. User Existence and Status Checks
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found with this phone number.",
        });
      }

      // --- CHANGE HERE: Check if user.status is boolean false ---
      if (user.status === false) {
        // If status is boolean false, user is inactive
        return res.status(400).json({
          success: false,
          message: "Your account is deactivated. Please contact support.",
        });
      }

      // Generate JWT token
      const token = createToken(user.toObject());

      // Clean up the used OTP
      delete otpStorage[formattedPhone];

      // Send a consistent and complete response
      return res.json({
        success: true,
        message: "OTP verified successfully, user logged in",
        token,
        user, // Returning the full user object for consistency with BDE login
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

    let user = await User.findOne({ mobileNumber });

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

exports.checkInUser = async (req, res) => {
  try {
    const { entry_time_location } = req.body;
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        message: "Authentication required. User not identified.",
        success: false,
      });
    }

    if (!entry_time_location) {
      return res.status(400).json({
        message: "Entry time locations are required.",
        success: false,
      });
    }

    const userId = req.user._id;
    const now = new Date(); // This Date object is in the server's local timezone init
    const options = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Kolkata", // Specify Indian Standard Time (IST)
    };
    const todayISTString = new Intl.DateTimeFormat("en-CA", options).format(
      now
    );
    // Example: if now is 2025-07-25 01:00 AM IST, todayISTString will be "2025-07-25"

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found in database.",
        success: false,
      });
    }

    // Helper to get a record's date in IST YYYY-MM-DD format for accurate comparison
    const getRecordDateISTString = (recordDate) => {
      if (!recordDate) return null;
      try {
        const dateObj = new Date(recordDate); // Convert to Date object first if it's not already
        return new Intl.DateTimeFormat("en-CA", options).format(dateObj);
      } catch (e) {
        console.error("Error formatting record date for IST comparison:", e);
        return null;
      }
    };

    // Check for an existing approved leave record for today (IST)
    const existingApprovedLeave = user.attendence_list.find(
      (att) =>
        att.date &&
        getRecordDateISTString(att.date) === todayISTString && // Use IST comparison
        att.status === "leave" &&
        att.leave_approval === "approved"
    );

    if (existingApprovedLeave) {
      return res.status(409).json({
        message: `You are already on an approved leave for today (${todayISTString}).`,
        success: false,
        attendanceRecord: existingApprovedLeave,
      });
    }

    // Check for an existing open attendance record for today (IST)
    const existingOpenAttendance = user.attendence_list.find(
      (att) =>
        att.date &&
        getRecordDateISTString(att.date) === todayISTString && // Use IST comparison
        att.status === "present" &&
        !att.exit_time // Check if exit_time is not set (implies open record)
    );

    if (existingOpenAttendance) {
      return res.status(409).json({
        message: `You are already checked in for today (${todayISTString}).`,
        success: false,
        attendanceRecord: existingOpenAttendance,
      });
    }

    // Check if the user has already completed a check-in/out for today (IST)
    const existingCompletedAttendance = user.attendence_list.find(
      (att) =>
        att.date &&
        getRecordDateISTString(att.date) === todayISTString && // Use IST comparison
        att.status === "present" &&
        att.exit_time // Check if exit_time is set (implies completed record)
    );

    if (existingCompletedAttendance) {
      return res.status(409).json({
        message: `You have already completed your attendance for today (${todayISTString}). Multiple check-ins are not allowed.`,
        success: false,
        attendanceRecord: existingCompletedAttendance,
      });
    }

    // If no existing record for today (IST), create a new one
    const newAttendanceRecord = {
      date: now, // Store the full Date object. MongoDB will store it as UTC.
      // For entry_time string, use toLocaleString with IST timezone
      entry_time: now.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: false,
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "long",
      }),
      // This will produce a string like: "Thu Jul 24 2025 23:24:49 GMT+0530 (India Standard Time)"
      exit_time: null, // Initialize as null
      day_count: "0",
      entry_time_location,
      status: "present",
    };

    user.attendence_list.push(newAttendanceRecord);
    await user.save();

    res.status(200).json({
      message: "User checked in successfully.",
      attendanceRecord: newAttendanceRecord,
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
    const { exit_time_location } = req.body;

    if (!req.user || !req.user._id) {
      // Ensure req.user._id is present
      return res.status(401).json({
        message: "Authentication required. User not identified.",
        success: false,
      });
    }

    if (!exit_time_location) {
      return res.status(400).json({
        message: "Exit time locations are required.",
        success: false,
      });
    }

    const userId = req.user._id;
    const now = new Date(); // Get current date/time (server's local, but internally UTC)

    // --- CRITICAL CHANGE: Get today's date string for comparison in IST ---
    const options = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Kolkata", // Specify Indian Standard Time (IST)
    };
    const todayISTString = new Intl.DateTimeFormat("en-CA", options).format(
      now
    );
    // Example: if now is July 25, 2025, 1:00 AM IST, todayISTString will be "2025-07-25"

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found in database.",
        success: false,
      });
    }

    // Helper to get a record's date in IST YYYY-MM-DD format for accurate comparison
    const getRecordDateISTString = (recordDate) => {
      if (!recordDate) return null;
      try {
        // Ensure it's a Date object before formatting (Mongoose usually returns Date objects)
        const dateObj = new Date(recordDate);
        return new Intl.DateTimeFormat("en-CA", options).format(dateObj);
      } catch (e) {
        console.error("Error formatting record date for IST comparison:", e);
        return null;
      }
    };

    // Find the attendance record for today (IST) that has an entry_time but no exit_time
    let targetAttendanceIndex = -1;
    for (let i = user.attendence_list.length - 1; i >= 0; i--) {
      const att = user.attendence_list[i];
      if (
        att.date &&
        getRecordDateISTString(att.date) === todayISTString && // Use IST comparison
        !att.exit_time && // Check if exit_time is not set (implies open record)
        att.status === "present"
      ) {
        targetAttendanceIndex = i;
        break; // Found the most recent open record for today (IST)
      }
    }

    if (targetAttendanceIndex === -1) {
      return res.status(400).json({
        message: `No open check-in record found for today (${todayISTString}) to mark exit.`,
        success: false,
      });
    }

    const attendanceRecord = user.attendence_list[targetAttendanceIndex];

    // Ensure entry_time exists before proceeding
    if (!attendanceRecord.entry_time) {
      return res.status(500).json({
        message: "Corrupted attendance record: missing entry time.",
        success: false,
      });
    }

    // Set exit_time: Store the full Date object (will be UTC in MongoDB)
    attendanceRecord.exit_time = now;
    // Store exit_time_location
    attendanceRecord.exit_time_location = exit_time_location; // Assign the received location data

    // --- Calculate day_count based on your specific logic ---
    // Ensure entryDateTime is correctly parsed from the stored string.
    // The entry_time string format "Thu Jul 24 2025 23:24:49 GMT+0530 (India Standard Time)"
    // is usually parsable by Date.parse(), but it's always good to be cautious.
    const entryDateTime = new Date(attendanceRecord.entry_time);
    const exitDateTime = new Date(attendanceRecord.exit_time);

    // Validate if parsing was successful
    if (isNaN(entryDateTime.getTime()) || isNaN(exitDateTime.getTime())) {
      return res.status(500).json({
        message: "Failed to parse entry/exit times for duration calculation.",
        success: false,
      });
    }

    // Calculate duration in milliseconds
    let durationMs = exitDateTime.getTime() - entryDateTime.getTime();

    // Check for negative duration: if exit is before entry or if it's an overnight
    // shift where the 'today' comparison didn't bridge the days.
    if (durationMs < 0) {
      // This implies an entry from a previous day's IST which this checkout is for.
      // Or a logical error. If allowing multi-day shifts, the `findIndex` logic
      // needs to be re-evaluated to find open records regardless of the calendar day.
      console.warn(
        "Negative duration calculated for attendance record. This might indicate an overnight shift or data issue.",
        "Entry:",
        attendanceRecord.entry_time,
        "Exit:",
        now,
        "Duration (ms):",
        durationMs
      );
      // For now, if negative, we can default to 0 hours or flag an error.
      // Assuming single-day attendance:
      durationMs = 0; // Treat as 0 hours for calculation purposes if logic is for same-day
    }

    const durationHours = durationMs / (1000 * 60 * 60); // Convert milliseconds to hours

    // Apply the day_count logic
    if (durationHours >= 8) {
      attendanceRecord.day_count = "1";
      attendanceRecord.status = "present";
    } else if (durationHours >= 4) {
      attendanceRecord.day_count = "0.5";
      attendanceRecord.status = "present";
    } else if (durationHours > 0) {
      // Worked some time but less than half day threshold
      attendanceRecord.day_count = "0.5"; // Or "0" based on your exact policy
      attendanceRecord.status = "present";
    } else {
      // Duration is 0 or negative
      attendanceRecord.day_count = "0";
      attendanceRecord.status = "absent"; // Consider absent if no effective work done
    }

    await user.save(); // Save the updated user document

    res.status(200).json({
      message: "Check out successful. Attendance updated.",
      attendanceRecord: attendanceRecord, // Return the updated record
      success: true,
    });
  } catch (error) {
    console.error("Check out error:", error);
    res.status(500).json({
      message: "Internal server error. Please try again.",
      success: false,
    });
  }
};

exports.applyLeave = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      // Ensure req.user._id is present
      return res.status(401).json({
        message: "Authentication required. User not identified.",
        success: false,
      });
    }

    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found in database.",
        success: false,
      });
    }

    const { date, leave_reason } = req.body;

    // Validate and normalize the requested leave date
    const requestedLeaveDate = new Date(date);
    if (isNaN(requestedLeaveDate.getTime())) {
      return res.status(400).json({
        message: "Invalid date provided for leave request.",
        success: false,
      });
    }
    // Set hours to UTC start of day to ensure consistent date comparison regardless of timezone
    requestedLeaveDate.setUTCHours(0, 0, 0, 0);

    // Find if an attendance record for this specific date already exists
    let existingAttendanceRecord = user.attendence_list.find((att) => {
      // Ensure att.date is a valid Date object for comparison
      if (!att.date) return false;
      const recordDate = new Date(att.date);
      if (isNaN(recordDate.getTime())) return false;

      // Normalize recordDate to UTC start of day for accurate comparison
      recordDate.setUTCHours(0, 0, 0, 0);

      return recordDate.getTime() === requestedLeaveDate.getTime();
    });

    if (existingAttendanceRecord) {
      // Scenario 1: Record exists for the date
      if (existingAttendanceRecord.entry_time) {
        // If entry_time is present, user already checked in for that day.
        // Cannot request full-day leave if already checked in.
        return res.status(400).json({
          message: `Cannot request leave for ${
            requestedLeaveDate.toISOString().split("T")[0]
          }. You have already checked in for this day.`,
          success: false,
        });
      } else if (
        existingAttendanceRecord.status === "leave" &&
        existingAttendanceRecord.leave_approval === "pending"
      ) {
        // If a pending leave request already exists for this date, inform user
        return res.status(409).json({
          // 409 Conflict
          message: `A pending leave request already exists for ${
            requestedLeaveDate.toISOString().split("T")[0]
          }.`,
          success: false,
        });
      } else {
        // Record exists but no entry_time (e.g., default 'absent' record, or previous leave request)
        // Update this existing record for leave
        existingAttendanceRecord.status = "leave";
        existingAttendanceRecord.leave_reason = leave_reason;
        existingAttendanceRecord.leave_approval = "pending";
        // Ensure entry_time and exit_time are explicitly cleared for a leave day
        existingAttendanceRecord.entry_time = "";
        existingAttendanceRecord.exit_time = "";
        existingAttendanceRecord.day_count = "0"; // A leave day typically counts as 0 work days
        // Clear locations if they exist for a non-present status
        if (existingAttendanceRecord.entry_time_location)
          existingAttendanceRecord.entry_time_location = undefined;
        if (existingAttendanceRecord.exit_time_location)
          existingAttendanceRecord.exit_time_location = undefined;
      }
    } else {
      // Scenario 2: No record exists for the date. Create a new one.
      const newLeaveRecord = {
        date: requestedLeaveDate, // Store the full Date object for the leave date
        entry_time: "", // No entry time for a leave day
        exit_time: "", // No exit time for a leave day
        day_count: "0", // A leave day typically counts as 0 work days
        status: "leave",
        leave_reason: leave_reason,
        leave_approval: "pending",
      };
      user.attendence_list.push(newLeaveRecord);
      existingAttendanceRecord = newLeaveRecord; // Set for response
    }

    await user.save(); // Save the updated user document

    res.status(200).json({
      message: "Leave request submitted successfully.",
      attendanceRecord: existingAttendanceRecord, // Return the updated/new record
      success: true,
    });
  } catch (error) {
    console.error("Leave request error:", error);
    res.status(500).json({
      message: "Internal server error. Please try again.",
      success: false,
    });
  }
};

exports.getLeaveRequests = async (req, res) => {
  try {
    const {
      userId,
      userType,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Validate pagination parameters
    if (isNaN(pageNumber) || pageNumber < 1) {
      return res.status(400).json({
        message: "Invalid page number. Must be a positive integer.",
        success: false,
      });
    }
    if (isNaN(limitNumber) || limitNumber < 1) {
      return res.status(400).json({
        message: "Invalid limit number. Must be a positive integer.",
        success: false,
      });
    }

    let initialMatchQuery = {}; // Match fields on the User document itself

    // Filter by specific userId (MongoDB _id) if provided
    if (userId) {
      // Assuming userId in query is the MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          message: "Invalid userId format. Must be a valid ObjectId.",
          success: false,
        });
      }
      initialMatchQuery._id = new mongoose.Types.ObjectId(userId);
    }

    // Filter by userType (designation) if provided
    if (userType) {
      const validDesignations = [
        "BDE",
        "Telecaller",
        "DigitalMarketer",
        "Admin",
        "HR",
      ];
      // Normalize userType to match enum casing
      const normalizedUserType =
        userType.charAt(0).toUpperCase() + userType.slice(1).toLowerCase();

      if (!validDesignations.includes(normalizedUserType)) {
        return res.status(400).json({
          message: `Invalid userType: '${userType}'. Must be one of ${validDesignations.join(
            ", "
          )}.`,
          success: false,
        });
      }
      initialMatchQuery.designation = normalizedUserType;
    }

    // Match conditions for the unwound attendance list
    let attendanceMatchQuery = {
      "attendence_list.status": "leave", // Always filter for leave records
    };

    // Filter by leave_approval status if provided
    if (status) {
      const validApprovalStatuses = ["approved", "rejected", "pending"];
      if (!validApprovalStatuses.includes(status.toLowerCase())) {
        return res.status(400).json({
          message: `Invalid leave approval status: '${status}'. Must be 'approved', 'rejected', or 'pending'.`,
          success: false,
        });
      }
      attendanceMatchQuery["attendence_list.leave_approval"] =
        status.toLowerCase();
    }

    // Filter by date range for the attendance record
    if (startDate || endDate) {
      const dateConditions = {};
      if (startDate) {
        const startOfDay = new Date(startDate);
        startOfDay.setUTCHours(0, 0, 0, 0); // Start of day in UTC
        dateConditions.$gte = startOfDay;
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setUTCHours(23, 59, 59, 999); // End of day in UTC
        dateConditions.$lte = endOfDay;
      }
      attendanceMatchQuery["attendence_list.date"] = dateConditions;
    }

    // Aggregation pipeline for efficient querying
    const pipeline = [
      { $match: initialMatchQuery }, // Initial match on the User document
      { $unwind: "$attendence_list" }, // Deconstruct the attendence_list array

      // Match on the unwound attendance list items
      { $match: attendanceMatchQuery },

      {
        $project: {
          _id: 0, // Exclude the default _id from the root document
          userId: "$_id", // The MongoDB ObjectId of the user
          userType: "$designation",
          userCId: "$userId", // This is the string userId, like "EMP-001"
          userName: "$name",
          userNumber: "$phone",

          attendanceRecordId: "$attendence_list._id", // The _id of the specific subdocument
          date: "$attendence_list.date",
          leave_reason: "$attendence_list.leave_reason",
          leave_approval: "$attendence_list.leave_approval",
          status: "$attendence_list.status", // This will always be "leave" due to the $match
        },
      },
      {
        $sort: { date: -1 }, // Sort by date descending (most recent first)
      },
      // Pagination stages
      { $skip: skip },
      { $limit: limitNumber },
    ];

    // Pipeline for counting total matching documents (for pagination metadata)
    const countPipeline = [
      { $match: initialMatchQuery },
      { $unwind: "$attendence_list" },
      { $match: attendanceMatchQuery },
      { $count: "totalCount" },
    ];

    const [leaveRequests, totalCountResult] = await Promise.all([
      User.aggregate(pipeline),
      User.aggregate(countPipeline),
    ]);

    const totalCount =
      totalCountResult.length > 0 ? totalCountResult[0].totalCount : 0;
    const totalPages = Math.ceil(totalCount / limitNumber);

    res.status(200).json({
      message: "Leave requests fetched successfully.",
      leaveRequests: leaveRequests,
      totalCount: totalCount,
      totalPages: totalPages,
      currentPage: pageNumber,
      pageSize: limitNumber,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    res.status(500).json({
      message: "Internal server error. Please try again.",
      success: false,
    });
  }
};

exports.updateLeaveRequest = async (req, res) => {
  try {
    const { userId, recordId } = req.params; // Get userId (MongoDB _id) and recordId (subdocument _id) from URL parameters
    const { leave_approval } = req.body; // Get new approval status from body

    // Validate leave_approval value
    const validApprovalStatuses = ["approved", "rejected", "pending"];
    if (!validApprovalStatuses.includes(leave_approval)) {
      return res.status(400).json({
        message:
          "Invalid leave_approval status provided. Must be 'approved', 'rejected', or 'pending'.",
        success: false,
      });
    }

    // Validate userId format (assuming it's a MongoDB ObjectId)
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        message: "Invalid user ID format. Must be a valid ObjectId.",
        success: false,
      });
    }

    // Find the user by their MongoDB ObjectId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found in database.",
        success: false,
      });
    }

    // Find the specific attendance record within the user's attendence_list
    // Mongoose's .id() method is efficient for finding subdocuments by their _id
    const attendanceRecord = user.attendence_list.id(recordId);

    if (!attendanceRecord) {
      return res.status(404).json({
        message: "Leave request record not found for this user and ID.",
        success: false,
      });
    }

    // Ensure it's actually a leave request before updating approval
    if (attendanceRecord.status !== "leave") {
      return res.status(400).json({
        message:
          "Cannot update approval for a record that is not a leave request. Its status is: " +
          attendanceRecord.status,
        success: false,
      });
    }

    // Prevent re-approving or re-rejecting if already in that state
    if (attendanceRecord.leave_approval === leave_approval) {
      return res.status(400).json({
        message: `Leave request is already in '${leave_approval}' status. No change needed.`,
        success: false,
      });
    }

    // Update the leave_approval status
    attendanceRecord.leave_approval = leave_approval;

    await user.save(); // Save the updated user document

    res.status(200).json({
      message: `Leave request ${recordId} for user ${user.userId} updated to ${leave_approval}.`, // Using user.userId (string ID) in message
      updatedRecord: attendanceRecord,
      success: true,
    });
  } catch (error) {
    console.error("Error updating leave request:", error);
    res.status(500).json({
      message: "Internal server error. Please try again.",
      success: false,
    });
  }
};
