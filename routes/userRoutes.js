// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// Get all users
router.get("/users", userController.getAllUsers);
router.get("/users/checknumber", userController.getUserByPhone);
router.post("/users/send-otp", userController.sendOtp);
router.post("/users/verify-otp", userController.verifyOtp);
router.post("/users/verify-with-otp", userController.verifyWithOtp);

// Create a new user
router.post("/users", userController.createUser);
router.post("/admin/login", userController.loginUser);

router.put("/users/reset-password", userController.resetPassword);

module.exports = router;
