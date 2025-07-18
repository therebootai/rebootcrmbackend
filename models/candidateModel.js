const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const candidateSchema = new Schema(
  {
    candidateId: {
      type: String,
      unique: true,
      required: true,
    },
    candidatename: { type: String, required: true },
    mobileNumber: { type: String, required: true, unique: true },
    altMobileNumber: { type: String, sparse: true },
    city: { type: String, required: true },
    interestPost: {
      type: String,
      required: true,
      enum: [
        "Business Development Executive",
        "Team Leader Sales",
        "Digital Marketing Executive",
        "Telecaller",
        "HR",
        "Content Writer",
        "UI / UX Developer",
        "Creative Graphics Designer",
        "Full Stack Developer",
        "App Developer",
      ],
    },
    lastQualification: { type: String, required: true },
    experience: { type: String },
    remarks: { type: String },
    cv: {
      type: {
        secure_url: { type: String },
        public_id: { type: String },
      },
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware to set altMobileNumber to null if it is an empty string
candidateSchema.pre("save", function (next) {
  if (this.altMobileNumber === "") {
    this.altMobileNumber = null;
  }
  next();
});

const formatDate = (date) => {
  const options = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  return new Intl.DateTimeFormat("en-GB", options)
    .format(date)
    .replace(",", "");
};

candidateSchema.virtual("formattedCreatedAt").get(function () {
  return formatDate(this.createdAt);
});

candidateSchema.set("toJSON", { virtuals: true });
candidateSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("candidate", candidateSchema);
