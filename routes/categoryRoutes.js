// routes/categoryRoutes.js
const express = require("express");
const {
  createCategory,
  getCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

const router = express.Router();

router.post("/create", createCategory);
router.get("/get", getCategory);
router.put("/update/:categoryId", updateCategory);
router.delete("/delete/:categoryId", deleteCategory);

module.exports = router;
