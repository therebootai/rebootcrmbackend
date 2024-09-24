const BDE = require("../models/bdeModel");
const Telecaller = require("../models/telecallerModel");
const DigitalMarketer = require("../models/digitalMarketerModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  const { mobileNumber, password } = req.body;

  if (!mobileNumber || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Check BDE model
    let user = await BDE.findOne({ mobileNumber });
    if (user) {
      // Check if the user is inactive
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
        { expiresIn: "1h" }
      );

      return res.status(200).json({
        token,
        name: user.bdename,
        role: "bde",
        id: user.bdeId,
      });
    }

    // Check Telecaller model
    user = await Telecaller.findOne({ mobileNumber });
    if (user) {
      // Check if the user is inactive
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
        { expiresIn: "1h" }
      );

      return res.status(200).json({
        token,
        name: user.telecallername,
        role: "telecaller",
        id: user.telecallerId,
      });
    }

    // Check DigitalMarketer model
    user = await DigitalMarketer.findOne({ mobileNumber });
    if (user) {
      // Check if the user is inactive
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

    // If the user is not found in any collection
    return res.status(400).json({ message: "Invalid credentials" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
