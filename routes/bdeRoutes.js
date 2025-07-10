const express = require("express");
const router = express.Router();
const bdeController = require("../controllers/bdeController");

router.post("/create", bdeController.createBDE);
router.get("/get", bdeController.getBDE);
router.get("/get/:bdeId", bdeController.getBDEById);
router.delete("/delete/:bdeId", bdeController.deleteBDE);
router.put("/update/:bdeId", bdeController.updateBDE);
router.post("/addTarget/:bdeId", bdeController.addTargetToBDE);
router.put("/updatetarget/:bdeId", bdeController.updateTargetAchievement);

router.delete("/clearTargets/:bdeId", bdeController.clearTargetsFromBDE);
router.post("/assignBusiness/:bdeId", bdeController.assignBusiness);
router.post(
  "/removeAssignedBusiness/:bdeId",
  bdeController.removeAssignedBusiness
);

module.exports = router;
