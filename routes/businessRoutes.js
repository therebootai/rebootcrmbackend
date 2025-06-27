const express = require("express");
const router = express.Router();
const businessController = require("../controllers/businessController");
const { checkAuth } = require("../middleware/checkAuth");

router.post("/create", checkAuth, businessController.createBusiness);
router.get("/get", businessController.getBusiness);
router.get("/marketingget", businessController.getBusinessformarketing);

router.get("/getfilter", businessController.getBusinessFilter);
router.get("/get/:businessId", businessController.getBusinessById);
router.put("/update/:businessId", businessController.updateBusiness);
router.put("/tagappointment/:businessId", businessController.tagAppointment);
router.post("/uploadexcel", businessController.excelImport);
router.delete("/delete/:businessId", businessController.deleteBusiness);
router.delete(
  "/categorydelete/:category",
  businessController.deleteBusinessesByCategory
);

module.exports = router;
