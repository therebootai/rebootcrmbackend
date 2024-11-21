const CareerJobPost = require("../models/careerJobPostModel");

// Helper function to generate unique job post ID
const generateJobPostId = async () => {
  const jobPosts = await CareerJobPost.find({}, { jobpostId: 1, _id: 0 }).sort({
    jobpostId: 1,
  });
  const jobPostIds = jobPosts.map((post) =>
    parseInt(post.jobpostId.replace("jobpostId", ""), 10)
  );

  let jobpostId = 1;
  for (let i = 0; i < jobPostIds.length; i++) {
    if (jobpostId < jobPostIds[i]) {
      break;
    }
    jobpostId++;
  }

  return `jobpostId${String(jobpostId).padStart(4, "0")}`;
};

// Create a new job post
exports.createJobPost = async (req, res) => {
  try {
    const { jobPostName, jobrole, jobTags, jobDescription, jobLocation } =
      req.body;

    // Validation
    if (!jobPostName || !jobrole) {
      return res
        .status(400)
        .json({ message: "Job Post Name and Job Role are required" });
    }

    const jobpostId = await generateJobPostId();

    const newJobPost = new CareerJobPost({
      jobpostId,
      jobPostName,
      jobrole,
      jobTags,
      jobLocation,
      jobDescription,
    });

    const savedJobPost = await newJobPost.save();

    res.status(201).json({
      message: "Job post created successfully",
      data: savedJobPost,
    });
  } catch (error) {
    console.error("Error creating job post:", error);
    res.status(500).json({
      message: "An error occurred while creating the job post",
      error: error.message,
    });
  }
};

// Get all job posts with filters
exports.getJobPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10, active, jobPostName, jobrole } = req.query;

    const filters = {};

    if (active !== undefined) {
      filters.active = active === "true";
    }

    if (jobPostName) {
      filters.jobPostName = { $regex: jobPostName, $options: "i" };
    }

    if (jobrole) {
      filters.jobrole = { $regex: jobrole, $options: "i" };
    }

    const jobPosts = await CareerJobPost.find(filters)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const totalJobPosts = await CareerJobPost.countDocuments(filters);

    res.status(200).json({
      message: "Job posts fetched successfully",
      data: jobPosts,
      totalPages: Math.ceil(totalJobPosts / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    console.error("Error fetching job posts:", error);
    res.status(500).json({
      message: "An error occurred while fetching the job posts",
      error: error.message,
    });
  }
};

// Get unique job roles for dropdown
exports.getJobRolesDropdown = async (req, res) => {
  try {
    // Fetch distinct job roles
    const jobRoles = await CareerJobPost.distinct("jobrole");

    res.status(200).json({
      message: "Job roles fetched successfully",
      data: jobRoles,
    });
  } catch (error) {
    console.error("Error fetching job roles:", error);
    res.status(500).json({
      message: "An error occurred while fetching the job roles",
      error: error.message,
    });
  }
};

// Edit/Update a job post
exports.updateJobPost = async (req, res) => {
  try {
    const { jobpostId } = req.params;

    // Check if jobpostId is provided
    if (!jobpostId) {
      return res.status(400).json({ message: "Job post ID is required" });
    }

    const updatedJobPost = await CareerJobPost.findOneAndUpdate(
      { jobpostId },
      { $set: req.body },
      { new: true }
    );

    if (!updatedJobPost) {
      return res.status(404).json({ message: "Job post not found" });
    }

    res.status(200).json({
      message: "Job post updated successfully",
      data: updatedJobPost,
    });
  } catch (error) {
    console.error("Error updating job post:", error);
    res.status(500).json({
      message: "An error occurred while updating the job post",
      error: error.message,
    });
  }
};

// Delete a job post
exports.deleteJobPost = async (req, res) => {
  try {
    const { jobpostId } = req.params;

    // Check if jobpostId is provided
    if (!jobpostId) {
      return res.status(400).json({ message: "Job post ID is required" });
    }

    const deletedJobPost = await CareerJobPost.findOneAndDelete({ jobpostId });

    if (!deletedJobPost) {
      return res
        .status(404)
        .json({ message: "Job post not found or already deleted" });
    }

    res.status(200).json({
      message: "Job post deleted successfully",
      data: deletedJobPost,
    });
  } catch (error) {
    console.error("Error deleting job post:", error);
    res.status(500).json({
      message: "An error occurred while deleting the job post",
      error: error.message,
    });
  }
};
