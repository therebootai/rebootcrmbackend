const { uploadFile } = require("../middleware/cloudinary");
const candidate = require("../models/candidateModel");
const cloudinary = require("cloudinary").v2;

const generatecandidateId = async () => {
  const candidates = await candidate
    .find({}, { candidateId: 1, _id: 0 })
    .sort({ candidateId: 1 });
  const candidateIds = candidates.map((candidate) =>
    parseInt(candidate.candidateId.replace("candidateId", ""), 10)
  );

  let candidateId = 1;
  for (let i = 0; i < candidateIds.length; i++) {
    if (candidateId < candidateIds[i]) {
      break;
    }
    candidateId++;
  }

  return `candidateId${String(candidateId).padStart(4, "0")}`;
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create a new Business
exports.createCandidate = async (req, res) => {
  try {
    const {
      candidatename,
      mobileNumber,
      altMobileNumber,
      city,
      interestPost,
      lastQualification,
      experience,
      remarks,
    } = req.body;

    let cvUploadedData = null;

    if (req.files && req.files.cv) {
      const { cv } = req.files;
      cvUploadedData = await uploadFile(cv.tempFilePath, cv.mimetype);
    }

    const candidateId = await generatecandidateId();
    const newCandidate = new candidate({
      candidateId,
      candidatename,
      mobileNumber,
      altMobileNumber,
      city,
      interestPost,
      lastQualification,
      experience,
      remarks,
      cv: {
        secure_url: cvUploadedData?.secure_url,
        public_id: cvUploadedData?.public_id,
      },
    });

    await newCandidate.save();

    res
      .status(201)
      .json({ message: "Candidate created successfully", newCandidate });
  } catch (error) {
    console.error("Error creating Candidate", error.message);
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      const errorMessage =
        field === "mobileNumber"
          ? "Mobile number already exists"
          : "Duplicate key error";

      res.status(400).json({ error: errorMessage });
    } else {
      res.status(500).json({ error: "Server error" });
    }
  }
};

// alll business fetch
exports.getCandidate = async (req, res) => {
  try {
    const {
      interestPost,
      city,
      page = 1,
      limit = 12,
      startdate,
      enddate,
      search,
    } = req.query;

    let filter = {};

    if (search) {
      filter.$or = [
        { candidatename: { $regex: search, $options: "i" } },
        { mobileNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (startdate && enddate) {
      filter.createdAt = {
        $gte: new Date(startdate),
        $lte: new Date(enddate),
      };
    } else if (startdate) {
      filter.createdAt = { $gte: new Date(startdate) };
    } else if (enddate) {
      filter.createdAt = { $lte: new Date(enddate) };
    }

    if (interestPost) filter.interestPost = interestPost;
    if (city) filter.city = city;

    const skip = (page - 1) * limit;

    const [candidates, totalCandidates] = await Promise.all([
      candidate.find(filter).skip(skip).limit(limit),
      candidate.countDocuments(filter),
    ]);

    res.status(200).json({
      candidates,
      pagination: {
        total: totalCandidates,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching candidates", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Get a Candidate by CandidateId
exports.getCandidateById = async (req, res) => {
  try {
    const { candidateId } = req.params;

    // Find lead by leadId
    const candidates = await candidate.findOne({ candidateId });
    if (!candidates) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    res.status(200).json(candidates);
  } catch (error) {
    console.error("Error fetching Candidate:", error.message);
    res.status(500).json({ message: "Error fetching Candidate", error });
  }
};

// Update a Candidate by candidateId
exports.updateCandidate = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const {
      candidatename,
      mobileNumber,
      altMobileNumber,
      city,
      interestPost,
      lastQualification,
      experience,
      remarks,
    } = req.body;

    // Find the lead to update by leadId
    const candidateUpdate = await candidate.findOne({ candidateId });
    if (!candidateUpdate) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    let cvUploadedData = null;

    if (req.files && req.files.cv) {
      const { cv } = req.files;
      if (candidateUpdate.cv.public_id) {
        await cloudinary.uploader.destroy(candidateUpdate.cv.public_id);
      }
      cvUploadedData = await uploadFile(cv.tempFilePath, cv.mimetype);
      candidateUpdate.cv = {
        secure_url: cvUploadedData?.secure_url,
        public_id: cvUploadedData?.public_id,
      };
    }

    // Update lead details
    candidateUpdate.candidatename =
      candidatename || candidateUpdate.candidatename;
    candidateUpdate.mobileNumber = mobileNumber || candidateUpdate.mobileNumber;
    candidateUpdate.city = city || candidateUpdate.city;
    candidateUpdate.altMobileNumber =
      altMobileNumber || candidateUpdate.altMobileNumber;
    candidateUpdate.interestPost = interestPost || candidateUpdate.interestPost;
    candidateUpdate.lastQualification =
      lastQualification || candidateUpdate.lastQualification;
    candidateUpdate.experience = experience || candidateUpdate.experience;
    candidateUpdate.remarks = remarks || candidateUpdate.remarks;
    candidateUpdate.cv = cvUploadedData
      ? {
          secure_url: cvUploadedData?.secure_url,
          public_id: cvUploadedData?.public_id,
        }
      : candidateUpdate.cv;

    // Save the updated lead
    await candidateUpdate.save();
    res
      .status(200)
      .json({ message: "Candidate updated successfully", candidateUpdate });
  } catch (error) {
    console.error("Error updating Candidate:", error.message);
    res.status(500).json({ message: "Error updating Candidate", error });
  }
};

// Delete a lead by leadId
exports.deleteCandidate = async (req, res) => {
  try {
    const { candidateId } = req.params;

    // Find the lead to delete
    const candidateDelete = await candidate.findOne({ candidateId });
    if (!candidateDelete) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    if (candidateDelete.cv.public_id) {
      await cloudinary.uploader.destroy(candidateDelete.cv.public_id);
    }

    // Delete the lead from the leads collection
    await candidate.findOneAndDelete({ candidateId });

    res.status(200).json({ message: "Candidate deleted successfully" });
  } catch (error) {
    console.error("Error deleting Candidate:", error.message);
    res.status(500).json({ message: "Error deleting Candidate", error });
  }
};

exports.getCandidateFilters = async (req, res) => {
  try {
    const [cities] = await Promise.all([candidate.distinct("city")]);
    res.status(200).json({ cities });
  } catch (error) {
    console.error("Error fetching filters:", error.message);
    res.status(500).json({ message: "Error fetching filters", error });
  }
};
