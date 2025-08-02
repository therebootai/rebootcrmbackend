// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// Get all users
router.get("/get", userController.getAllUsers);
router.get("/get/:userId", userController.getUserById);
router.get("/users/checknumber", userController.getUserByPhone);
router.get("/get-filters/:userId", userController.getUserFilters);

router.post("/users/send-otp", userController.sendOtp);
router.post("/users/verify-otp", userController.verifyOtp);
router.post("/users/verify-with-otp", userController.verifyWithOtp);

// Create a new user
router.post("/create", userController.createUser);
router.post("/admin/login", userController.loginUser);

router.put("/users/reset-password", userController.resetPassword);

router.put("/users/:userId", userController.updateUser);

router.get("/analytics/:user_id", userController.getUserAnalytics);

module.exports = router;
