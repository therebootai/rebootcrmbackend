// routes/categoryRoutes.js
const express = require("express");
const {
  createSource,
  getSource,
  updateSource,
  deleteSource,
} = require("../controllers/leadsourceController");

const router = express.Router();

router.post("/create", createSource);
router.get("/get", getSource);
router.put("/update/:sourceId", updateSource);
router.delete("/delete/:sourceId", deleteSource);

module.exports = router;
