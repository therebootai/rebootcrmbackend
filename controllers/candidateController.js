const candidate = require("../models/candidateModel");

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
      rating,
      status,
    } = req.body;

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
      rating,
      status,
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
          : field === "altMobileNumber"
          ? "Alternative mobile number already exists"
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
    const { interestPost, city, rating } = req.query;

    let filter = {};

    if (interestPost) filter.interestPost = interestPost;
    if (city) filter.city = city;
    if (rating) filter.rating = rating;

    const candidates = await candidate.find(filter);
    res.status(200).json(candidates);
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
      rating,
      status,
    } = req.body;

    // Find the lead to update by leadId
    const candidateUpdate = await candidate.findOne({ candidateId });
    if (!candidateUpdate) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    // Update lead details
    candidateUpdate.candidatename =
      candidatename || candidateUpdate.candidatename;
    candidateUpdate.mobileNumber = mobileNumber || candidateUpdate.mobileNumber;
    candidateUpdate.city = city || candidateUpdate.city;
    candidateUpdate.altMobileNumber =
      altMobileNumber || candidateUpdate.altMobileNumber;
    candidateUpdate.status = status || candidateUpdate.status;
    candidateUpdate.interestPost = interestPost || candidateUpdate.interestPost;
    candidateUpdate.lastQualification =
      lastQualification || candidateUpdate.lastQualification;
    candidateUpdate.experience = experience || candidateUpdate.experience;
    candidateUpdate.rating = rating || candidateUpdate.rating;

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

    // Delete the lead from the leads collection
    await candidate.findOneAndDelete({ candidateId });

    res.status(200).json({ message: "Candidate deleted successfully" });
  } catch (error) {
    console.error("Error deleting Candidate:", error.message);
    res.status(500).json({ message: "Error deleting Candidate", error });
  }
};
