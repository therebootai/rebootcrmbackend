const express = require("express");
const router = express.Router();
const {
  createFiles,
  getAllFiles,
  deleteFile,
  downloadFile,
} = require("../controllers/waimageController");

// Routes
router.post("/upload", createFiles);
router.get("/get", getAllFiles);
router.delete("/delete/:id", deleteFile);

module.exports = router;
