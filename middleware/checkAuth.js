const jwt = require("jsonwebtoken");
const bdeModel = require("../models/bdeModel");
const telecallerModel = require("../models/telecallerModel");
const User = require("../models/user");

exports.checkAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    let user;

    const userId = decoded.id;
    const userType = decoded.userType;

    if (!userId || !userType) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Invalid token payload" });
    }

    switch (userType) {
      case "bde":
        user = await bdeModel.findById(userId).select("-password"); // Exclude password from the returned user object
        break;
      case "telecaller":
        user = await telecallerModel.findById(userId).select("-password");
        break;
      case "user":
        user = await User.findById(userId).select("-password");
        break;
      default:
        return res
          .status(401)
          .json({ message: "Unauthorized: Unknown user type" });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;
    req.userType = userType;

    next();
  } catch (error) {
    console.log(error);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Unauthorized: Token expired" });
    }
    console.error("Error checking authentication:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.createToken = (payload) => {
  try {
    if (!payload) throw Error("Invalid payload");
    const token = jwt.sign(payload, process.env.SECRET_KEY, {
      expiresIn: "30d",
    });
    return token;
  } catch (error) {
    console.log(error);
    throw Error(error.message);
  }
};
