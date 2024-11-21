const mongoose = require("mongoose");

const careerJobPostSchema = new mongoose.Schema(
  {
    jobpostId: {
      type: String,
      unique: true,
      required: true,
    },
    jobPostName: {
      type: String,
      required: true,
    },
    jobrole: {
      type: String,
      required: true,
    },
    jobLocation: { type: String },
    jobTags: [String],
    jobDescription: {
      type: String,
      required: true,
    },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CareerJobPost", careerJobPostSchema);
