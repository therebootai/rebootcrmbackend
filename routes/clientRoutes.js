const express = require("express");
const router = express.Router();
const {
  createClient,
  getClients,
  getCollectionSummary,
  updateClient,
  deleteClient,
} = require("../controllers/clientController");

router.post("/create", createClient);
router.get("/get", getClients);
router.get("/collection-summary", getCollectionSummary);
router.put("/update/:clientId", updateClient);
router.delete("/delete/:clientId", deleteClient);

module.exports = router;
