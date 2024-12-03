const express = require("express");
const router = express.Router();
const blogController = require("../controllers/blogController");

// Routes
router.post("/create", blogController.createBlog);
router.get("/get", blogController.getBlogs);
router.get("/latest", blogController.getCategoryBlogs);

router.get("/get/:blogId", blogController.getBlogById);

router.get("/category-dropdown", blogController.getCategoryDropdown);
router.get("/category-dropdown-random", blogController.getRandomCategories);

router.patch("/:blogId/view", blogController.incrementViewCount);

router.put("/update/:blogId", blogController.updateBlog);
router.delete("/delete/:blogId", blogController.deleteBlog);

module.exports = router;
