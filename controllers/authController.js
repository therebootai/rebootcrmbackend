const BDE = require("../models/bdeModel");
const Telecaller = require("../models/telecallerModel");
const DigitalMarketer = require("../models/digitalMarketerModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { default: axios } = require("axios");

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
        },
        process.env.SECRET_KEY,
        { expiresIn: "30d" }
      );

      return res.status(200).json({
        token,
        name: user.bdename,
        role: "bde",
        id: user.bdeId,
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
