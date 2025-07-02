const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { checkAuth } = require("../middleware/checkAuth");

router.post("/login", authController.login);
router.get("/employees/checknumber", authController.getUserByPhone);
router.post("/employees/send-otp", authController.sendOtp);
router.post("/employees/verify-otp", authController.verifyOtp);
router.post("/employees/verify-with-otp", authController.verifyWithOtp);
router.put("/employees/reset-password", authController.resetPassword);

router.get("/logout", checkAuth, authController.logout);

module.exports = router;
