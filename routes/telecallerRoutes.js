const express = require("express");
const router = express.Router();
const telecallerController = require("../controllers/telecallerController");

router.post("/create", telecallerController.createTelecaller);
router.get("/get", telecallerController.getTelecaller);
router.get("/get/:telecallerId", telecallerController.getTelecallerById);
router.delete("/delete/:telecallerId", telecallerController.deleteTelecaller);
router.put("/update/:telecallerId", telecallerController.updateTelecaller);
router.put("/update/:telecallerId", telecallerController.updateTelecaller);
router.post(
  "/addTarget/:telecallerId",
  telecallerController.addTargetToTelecaller
);
router.put(
  "/updatetarget/:telecallerId",
  telecallerController.updateTargetAchievement
);
router.delete(
  "/clearTargets/:telecallerId",
  telecallerController.clearTargetsFromTelecaller
);
router.post("/login", telecallerController.loginTelecaller);
router.post(
  "/assignBusiness/:telecallerId",
  telecallerController.assignBusiness
);

router.post(
  "/removeAssignedBusiness/:telecallerId",
  telecallerController.removeAssignedBusiness
);

module.exports = router;
