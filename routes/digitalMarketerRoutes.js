const express = require("express");
const router = express.Router();
const digitalMarketerController = require("../controllers/digitalMarketerController");

router.post("/create", digitalMarketerController.createDigitalMarketer);
router.get("/get", digitalMarketerController.getDigitalMarketer);
router.get(
  "/get/:digitalMarketerId",
  digitalMarketerController.getDigitalMarketerById
);
router.delete(
  "/delete/:digitalMarketerId",
  digitalMarketerController.deleteDigitalMarketer
);
router.put(
  "/update/:digitalMarketerId",
  digitalMarketerController.updateDigitalMarketer
);
router.post(
  "/addTarget/:digitalMarketerId",
  digitalMarketerController.addTargetToDigitalMarketer
);
router.put(
  "/updatetarget/:digitalMarketerId",
  digitalMarketerController.updateTargetAchievement
);
router.put(
  "/clearTargets/:digitalMarketerId",
  digitalMarketerController.clearTargetsFromDigitalMarketer
);
router.post("/login", digitalMarketerController.loginDigitalMarketer);

router.post(
  "/assignBusiness/:digitalMarketerId",
  digitalMarketerController.assignBusiness
);
router.post(
  "/removeAssignedBusiness/:digitalMarketerId",
  digitalMarketerController.removeAssignedBusiness
);

module.exports = router;
