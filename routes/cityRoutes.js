// routes/categoryRoutes.js
const express = require("express");
const {
  createCity,
  getCity,
  updateCity,
  deleteCity,
} = require("../controllers/cityController");

const router = express.Router();

router.post("/create", createCity);
router.get("/get", getCity);
router.put("/update/:cityId", updateCity);
router.delete("/delete/:cityId", deleteCity);

module.exports = router;
