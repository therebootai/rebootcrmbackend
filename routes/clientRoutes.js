const express = require("express");
const router = express.Router();
const {
  createClient,
  getClients,
  updateClient,
} = require("../controllers/clientController");

router.post("/create", createClient);
router.get("/get", getClients);
router.put("/update/:clientId", updateClient);

module.exports = router;
