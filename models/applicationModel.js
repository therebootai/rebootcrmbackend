const mongoose = require("mongoose");

const applocationSchema = new mongoose.Schema(
  {
    applicationId: {
      type: String,
      unique: true,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    mobileNumber: {
      type: String,
      required: true,
    },
    applyingFor: { type: String, required: true },
    lastQualification: { type: String, required: true },
    totalExperience: {
      type: String,
    },
    uploadCV: {
      secure_url: {
        type: String,
        required: true,
      },
      public_id: {
        type: String,
        required: true,
      },
    },
    location: { type: String },
    jobPostName: {
      type: String,
      required: true,
    },
    jobrole: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Applications", applocationSchema);
