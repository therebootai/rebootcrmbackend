const Category = require("../models/categoryModel");

const generateCategoryId = async () => {
  const categories = await Category.find({}, { categoryId: 1, _id: 0 }).sort({
    categoryId: 1,
  });
  const categoryIds = categories.map((category) =>
    parseInt(category.categoryId.replace("categoryId", ""), 10)
  );

  let categoryId = 1;
  for (let i = 0; i < categoryIds.length; i++) {
    if (categoryId < categoryIds[i]) {
      break;
    }
    categoryId++;
  }

  return `categoryId${String(categoryId).padStart(4, "0")}`;
};

exports.createCategory = async (req, res) => {
  try {
    const { categoryname } = req.body;

    const categoryId = await generateCategoryId();
    const newCategory = new Category({
      categoryId,
      categoryname,
    });

    await newCategory.save();
    res
      .status(201)
      .json({ message: "Category created successfully", newCategory });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      return res
        .status(400)
        .json({ error: "Category already exists. Please try another name." });
    }
    console.error("Error creating Category:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getCategory = async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching Category:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { categoryname } = req.body;

    // Find the college to update
    const categoryUpdate = await Category.findOne({ categoryId });
    if (!categoryUpdate) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Update college details
    categoryUpdate.categoryname = categoryname || categoryUpdate.categoryname;

    // Save the updated college
    await categoryUpdate.save();
    res
      .status(200)
      .json({ message: "Category updated successfully", categoryUpdate });
  } catch (error) {
    console.error("Error updating Category:", error.message);
    res.status(500).json({ message: "Error updating college", error });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Find brand to get public_id
    const categoryDelete = await Category.findOne({ categoryId });
    if (!categoryDelete) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Delete brand from database
    await Category.findOneAndDelete({ categoryId });
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting college", error });
  }
};
