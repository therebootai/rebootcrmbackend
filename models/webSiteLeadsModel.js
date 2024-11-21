const mongoose = require("mongoose");

const websiteLeadsSchema = new mongoose.Schema(
  {
    webSiteleadsId: {
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
    email: {
      type: String,
    },
    consultationFor: {
      type: String,
      required: true,
    },
    massage: {
      type: String,
    },
    status: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("websiteLeads", websiteLeadsSchema);
