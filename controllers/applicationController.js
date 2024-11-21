const Applications = require("../models/applicationModel");
const { uploadFile } = require("../middleware/cloudinary");
const fs = require("fs");

const generateApplicationId = async () => {
  const application = await Applications.find(
    {},
    { applicationId: 1, _id: 0 }
  ).sort({
    applicationId: 1,
  });
  const applicationIds = application.map((application) =>
    parseInt(application.applicationId.replace("applicationId", ""), 10)
  );

  let applicationId = 1;
  for (let i = 0; i < applicationIds.length; i++) {
    if (applicationId < applicationIds[i]) {
      break;
    }
    applicationId++;
  }

  return `applicationId${String(applicationId).padStart(4, "0")}`;
};

exports.createApplication = async (req, res) => {
  try {
    if (!req.files || !req.files.uploadCV) {
      return res.status(400).json({ error: "No CV file uploaded." });
    }

    const file = req.files.uploadCV;

    if (file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Only PDF files are allowed." });
    }

    const applicationId = await generateApplicationId();

    const uploadResult = await uploadFile(file.tempFilePath, file.mimetype);

    if (!uploadResult || !uploadResult.secure_url || !uploadResult.public_id) {
      return res
        .status(500)
        .json({ error: "Failed to upload file to Cloudinary." });
    }

    const applicationData = {
      ...req.body,
      applicationId,
      uploadCV: {
        secure_url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
      },
    };

    const newApplication = new Applications(applicationData);
    await newApplication.save();

    fs.unlink(file.tempFilePath, (err) => {
      if (err) {
        console.error("Failed to delete temporary file:", err);
      } else {
        console.log("Temporary file deleted successfully.");
      }
    });

    res.status(201).json({
      message: "Application created successfully.",
      application: newApplication,
    });
  } catch (error) {
    console.error("Error creating application:", error);

    if (req.files && req.files.uploadCV && req.files.uploadCV.tempFilePath) {
      fs.unlink(req.files.uploadCV.tempFilePath, (err) => {
        if (err) console.error("Failed to delete temporary file:", err);
      });
    }

    res
      .status(500)
      .json({ error: "An error occurred while creating the application." });
  }
};

exports.getApplications = async (req, res) => {
  try {
    const { jobrole, startDate, endDate, limit = 10, page = 1 } = req.query;
    const filter = {};
    if (jobrole) {
      filter.jobrole = jobrole;
    }
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    const parsedLimit = parseInt(limit, 10);
    const parsedPage = parseInt(page, 10);

    const applications = await Applications.find(filter)
      .sort({ createdAt: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit);

    const totalApplications = await Applications.countDocuments(filter);

    res.status(200).json({
      message: "Applications retrieved successfully.",
      applications,
      pagination: {
        total: totalApplications,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(totalApplications / parsedLimit),
      },
    });
  } catch (error) {
    console.error("Error retrieving applications:", error);
    res
      .status(500)
      .json({ error: "An error occurred while retrieving applications." });
  }
};

exports.deleteApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    if (!applicationId) {
      return res.status(400).json({ error: "Application ID is required." });
    }
    const deletedApplication = await Applications.findOneAndDelete({
      applicationId,
    });

    if (!deletedApplication) {
      return res
        .status(404)
        .json({ error: "Application with the specified ID not found." });
    }

    res.status(200).json({
      message: "Application deleted successfully.",
      application: deletedApplication,
    });
  } catch (error) {
    console.error("Error deleting application:", error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the application." });
  }
};
