const jwt = require("jsonwebtoken");
const User = require("../models/user");

exports.checkAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided or invalid format" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: Token not found" });
    }

    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    const userId = decoded._id; // Expecting 'id' (which is MongoDB _id) from token payload
    const userTypeFromToken = decoded.designation; // Expecting 'userType' from token payload

    if (!userId || !userTypeFromToken) {
      return res.status(401).json({
        message:
          "Unauthorized: Invalid token payload (missing userId or userType)",
      });
    }

    // Now, always query the unified User model
    const user = await User.findById(userId)
      .select("-password")
      .populate("assignCategories")
      .populate("assignCities")
      .populate("employee_ref"); // Exclude password

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Optional: You can add an extra check to ensure the userType in the token matches
    // the userType stored in the database for the fetched user. This adds an extra layer
    // of security/consistency check.
    if (user.designation.toLowerCase() !== userTypeFromToken.toLowerCase()) {
      return res.status(403).json({ message: "Forbidden: User type mismatch" });
    }

    // Attach user information to the request object
    req.user = user;
    req.userType = user.designation.toLowerCase(); // Use the userType from the database for consistency

    next();
  } catch (error) {
    console.error("Authentication Error:", error); // Use a more descriptive log

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Unauthorized: Token expired" });
    }
    // Catch-all for other unexpected errors
    res
      .status(500)
      .json({ message: "Internal server error during authentication" });
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
