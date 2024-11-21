const express = require("express");
const router = express.Router();
const webSiteLeadsController = require("../controllers/webSiteLeadsController");

// Routes
router.post("/create", webSiteLeadsController.createWebsiteLead);
router.get("/get", webSiteLeadsController.getWebsiteLeads);
router.get("/dropdown-options", webSiteLeadsController.getDropdownOptions);

router.put("/update/:webSiteleadsId", webSiteLeadsController.updateWebsiteLead);
router.delete(
  "/delete/:webSiteleadsId",
  webSiteLeadsController.deleteWebsiteLead
);

module.exports = router;
