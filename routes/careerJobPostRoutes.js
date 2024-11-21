const express = require("express");
const careerJobPostController = require("../controllers/careerJobPostController");

const router = express.Router();

// Routes
router.post("/create", careerJobPostController.createJobPost);
router.get("/get", careerJobPostController.getJobPosts);
router.get("/jobroles", careerJobPostController.getJobRolesDropdown);

router.put("/update/:jobpostId", careerJobPostController.updateJobPost);
router.delete("/delete/:jobpostId", careerJobPostController.deleteJobPost);

module.exports = router;
