const Blogs = require("../models/blogModel");
const { uploadFile, deleteFile } = require("../middleware/cloudinary");
const fs = require("fs");
const slugify = require("slugify");

const generateblogId = async () => {
  const blogs = await Blogs.find({}, { blogId: 1, _id: 0 }).sort({
    blogId: 1,
  });
  const blogIds = blogs.map((blogs) =>
    parseInt(blogs.blogId.replace("blogId", ""), 10)
  );

  let blogId = 1;
  for (let i = 0; i < blogIds.length; i++) {
    if (blogId < blogIds[i]) {
      break;
    }
    blogId++;
  }

  return `blogId${String(blogId).padStart(4, "0")}`;
};

exports.createBlog = async (req, res) => {
  try {
    const { isDraft, blogTitle, publisherName, category, writeBlog } = req.body;

    // Validation logic based on whether it's a draft or a published blog
    if (isDraft === "false") {
      // For saving a published blog
      if (
        !blogTitle ||
        !publisherName ||
        !category ||
        !writeBlog ||
        !req.files ||
        !req.files.blogThumbnail
      ) {
        return res.status(400).json({
          message: "Required fields are missing for saving the blog",
        });
      }
    } else {
      // For saving as draft
      if (!blogTitle) {
        return res.status(400).json({
          message: "Blog title is required to save as draft",
        });
      }
    }

    const blogId = await generateblogId();

    if (req.files && req.files.blogThumbnail) {
      const file = req.files.blogThumbnail;

      const uploadResult = await uploadFile(file.tempFilePath, file.mimetype);

      thumbnailDetails = {
        secure_url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
      };

      fs.unlink(file.tempFilePath, (err) => {
        if (err) {
          console.error("Error deleting temp file:", err);
        }
      });
    } else if (isDraft === "false") {
      // If the blog is not a draft and no thumbnail is uploaded, throw an error
      throw new Error("Thumbnail is required for published blogs.");
    }

    const slug = slugify(blogTitle, { lower: true, strict: true });

    // Prepare the blog data
    const blogData = {
      blogId,
      blogTitle,
      publisherName: isDraft === "false" ? publisherName : undefined,
      category: isDraft === "false" ? category : undefined,
      blogThumbnails: isDraft === "false" ? thumbnailDetails : undefined,
      writeBlog: isDraft === "false" ? writeBlog : undefined,
      active: isDraft === "false",
      isdraft: isDraft === "true",
      slug,
      ...req.body,
    };

    const newBlog = new Blogs(blogData);

    // Save the blog to the database
    const savedBlog = await newBlog.save();

    // Respond with success
    res.status(201).json({
      message:
        isDraft === "true"
          ? "Blog saved as draft successfully"
          : "Blog created successfully",
      data: savedBlog,
    });
  } catch (error) {
    console.error("Error creating blog:", error);
    res.status(500).json({
      message: "An error occurred while creating the blog",
      error: error.message,
    });
  }
};

exports.getBlogs = async (req, res) => {
  try {
    const {
      page = 1,
      startDate,
      endDate,
      category,
      blogTitle,
      active,
      isdraft,
    } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    const filters = {};

    if (startDate) {
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date(startDate);
      end.setHours(23, 59, 59, 999);

      filters.createdAt = { $gte: start, $lte: end };
    }

    if (category) {
      filters.category = category;
    }

    if (blogTitle) {
      filters.blogTitle = { $regex: blogTitle, $options: "i" };
    }

    if (active !== undefined) {
      filters.active = active === "true";
    }

    // Draft status filter
    if (isdraft !== undefined) {
      filters.isdraft = isdraft === "true";
    }

    const blogs = await Blogs.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalBlogs = await Blogs.countDocuments(filters);

    res.status(200).json({
      message: "Blogs fetched successfully",
      data: blogs,
      totalBlogs,
      totalPages: Math.ceil(totalBlogs / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({
      message: "An error occurred while fetching the blogs",
      error: error.message,
    });
  }
};

exports.getCategoryBlogs = async (req, res) => {
  try {
    const { category, limit = 8, excludeBlogId } = req.query;

    if (!category) {
      return res.status(400).json({ message: "Category is required" });
    }

    const filters = { category };

    // Exclude the currently opened blog by its ID
    if (excludeBlogId) {
      filters.blogId = { $ne: excludeBlogId };
    }

    const blogs = await Blogs.find(filters)
      .sort({ createdAt: -1 }) // Sort by newest first
      .limit(Number(limit));

    res.status(200).json({
      message: "Blogs fetched successfully",
      data: blogs,
    });
  } catch (error) {
    console.error("Error fetching category blogs:", error);
    res.status(500).json({
      message: "An error occurred while fetching category blogs",
      error: error.message,
    });
  }
};

exports.getBlogById = async (req, res) => {
  try {
    const { blogId } = req.params;

    // Find lead by leadId
    const blog = await Blogs.findOne({ blogId });
    if (!blog) {
      return res.status(404).json({ message: "blog not found" });
    }

    res.status(200).json(blog);
  } catch (error) {
    console.error("Error fetching blog:", error.message);
    res.status(500).json({ message: "Error fetching blog", error });
  }
};

exports.getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    // Find blog by slug
    const blog = await Blogs.findOne({ slug });
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.status(200).json(blog);
  } catch (error) {
    console.error("Error fetching blog by slug:", error.message);
    res.status(500).json({ message: "Error fetching blog", error });
  }
};

exports.incrementViewCount = async (req, res) => {
  try {
    const { blogId } = req.params;

    // Find the blog by blogId
    const blog = await Blogs.findOne({ blogId });
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Increment the view count
    blog.viewsCount += 1;
    await blog.save();

    res.status(200).json({
      message: "View count incremented successfully",
      viewsCount: blog.viewsCount,
    });
  } catch (error) {
    console.error("Error incrementing view count:", error.message);
    res.status(500).json({ message: "Error incrementing view count", error });
  }
};

exports.getCategoryDropdown = async (req, res) => {
  try {
    const categories = await Blogs.distinct("category");

    res.status(200).json({
      message: "Categories fetched successfully",
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      message: "An error occurred while fetching the categories",
      error: error.message,
    });
  }
};
exports.getRandomCategories = async (req, res) => {
  try {
    const categories = await Blogs.distinct("category");

    const filteredCategories = categories.filter(
      (category) => category.trim() !== ""
    );
    const randomCategories = filteredCategories
      .sort(() => 0.7 - Math.random())
      .slice(0, 7);

    res.status(200).json({
      message: "Random categories fetched successfully",
      data: randomCategories,
    });
  } catch (error) {
    console.error("Error fetching random categories:", error);
    res.status(500).json({
      message: "An error occurred while fetching random categories",
      error: error.message,
    });
  }
};

exports.updateBlog = async (req, res) => {
  try {
    const { blogId } = req.params;

    // Check if blogId is provided
    if (!blogId) {
      return res.status(400).json({
        message: "Blog ID is required to update a blog",
      });
    }

    // Find the existing blog by blogId
    const existingBlog = await Blogs.findOne({ blogId });

    if (!existingBlog) {
      return res.status(404).json({
        message: "Blog not found",
      });
    }

    const { blogTitle, publisherName, category, writeBlog } = req.body;

    // Validation for updating draft to published
    if (existingBlog.isdraft) {
      // Validate all required fields to ensure they are present
      if (
        !blogTitle ||
        !publisherName ||
        !category ||
        !writeBlog ||
        !req.files ||
        !req.files.blogThumbnail
      ) {
        return res.status(400).json({
          message: "All fields are required to publish the blog",
        });
      }
    }

    let updatedFields = { ...req.body };

    // Automatically set `isdraft` to `false` and `active` to `true` if it's a draft
    if (existingBlog.isdraft) {
      updatedFields.isdraft = false;
      updatedFields.active = true;
    }

    // Check if the blogTitle has been updated
    if (blogTitle && blogTitle !== existingBlog.blogTitle) {
      const newSlug = slugify(blogTitle, { lower: true, strict: true });

      // Ensure the new slug is unique
      const slugExists = await Blogs.findOne({ slug: newSlug });
      if (slugExists && slugExists.blogId !== blogId) {
        return res.status(400).json({
          message:
            "Slug already exists for another blog. Try a different title.",
        });
      }

      updatedFields.slug = newSlug;
    }

    // Handle new image upload
    if (req.files && req.files.blogThumbnail) {
      const file = req.files.blogThumbnail;

      // Delete the existing image from Cloudinary
      if (
        existingBlog.blogThumbnails &&
        existingBlog.blogThumbnails.public_id
      ) {
        try {
          await deleteFile(existingBlog.blogThumbnails.public_id);
          console.log("Old thumbnail deleted successfully");
        } catch (error) {
          console.error("Error deleting old thumbnail:", error);
          throw new Error("Failed to delete the old image");
        }
      }

      // Upload new image to Cloudinary
      try {
        const uploadResult = await uploadFile(file.tempFilePath, file.mimetype);
        updatedFields.blogThumbnails = {
          secure_url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
        };
        console.log("New thumbnail uploaded successfully:", uploadResult);
      } catch (error) {
        console.error("Error uploading new thumbnail:", error);
        throw new Error("Failed to upload the new image");
      }

      // Remove the temporary file
      fs.unlink(file.tempFilePath, (err) => {
        if (err) {
          console.error("Error deleting temp file:", err);
        } else {
          console.log("Temporary file deleted successfully");
        }
      });
    }

    // Update the blog in the database
    const updatedBlog = await Blogs.findOneAndUpdate(
      { blogId },
      { $set: updatedFields },
      { new: true } // Return the updated document
    );

    // Respond with the updated blog
    res.status(200).json({
      message: existingBlog.isdraft
        ? "Draft updated and published successfully"
        : "Blog updated successfully",
      data: updatedBlog,
    });
  } catch (error) {
    console.error("Error updating blog:", error);
    res.status(500).json({
      message: "An error occurred while updating the blog",
      error: error.message,
    });
  }
};

exports.deleteBlog = async (req, res) => {
  try {
    const { blogId } = req.params;

    if (!blogId) {
      return res.status(400).json({
        message: "Blog ID is required to delete a blog",
      });
    }

    const blogToDelete = await Blogs.findOne({ blogId });

    if (!blogToDelete) {
      return res.status(404).json({
        message: "Blog not found or already deleted",
      });
    }

    if (blogToDelete.blogThumbnails?.public_id) {
      const cloudinaryResponse = await deleteFile(
        blogToDelete.blogThumbnails.public_id
      );

      if (cloudinaryResponse.result !== "ok") {
        console.error(
          "Error deleting image from Cloudinary:",
          cloudinaryResponse
        );
      }
    }

    const deletedBlog = await Blogs.findOneAndDelete({ blogId });

    res.status(200).json({
      message: "Blog and associated image deleted successfully",
      data: deletedBlog,
    });
  } catch (error) {
    console.error("Error deleting blog:", error);
    res.status(500).json({
      message: "An error occurred while deleting the blog",
      error: error.message,
    });
  }
};
