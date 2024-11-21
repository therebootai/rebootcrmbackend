const express = require("express");
const applicationController = require("../controllers/applicationController");

const router = express.Router();

router.post("/create", applicationController.createApplication);
router.get("/get", applicationController.getApplications);
router.delete(
  "/delete/:applicationId",
  applicationController.deleteApplication
);

module.exports = router;
