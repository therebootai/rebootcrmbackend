// controllers/userController.js
const User = require("../models/user");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const axios = require("axios");

dotenv.config();
// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
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

// Create a new user
exports.createUser = async (req, res) => {
  const { name, email, phone, password, designation } = req.body;

  // Validate required fields
  if (!name || !email || !phone || !password || !designation) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Create new user
    const newUser = new User({ name, email, phone, password, designation });
    const savedUser = await newUser.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: savedUser._id, email: savedUser.email },
      process.env.SECRET_KEY,
      { expiresIn: "1h" }
    );

    // Respond with the created user and token
    res.status(201).json({ user: savedUser, token });
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
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id.toString(), password: user.password, name: user.name },
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
    const { phone, name } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const formattedPhone = phone.startsWith("91") ? phone : "91" + phone;

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
      variables: ["User", otpCode.toString()],
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
      const user = await User.findOne({ phone: phone });
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
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
        },
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
