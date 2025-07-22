const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const businessSchema = new Schema(
  {
    businessId: {
      type: String,
      unique: true,
      required: true,
    },
    buisnessname: { type: String, required: true },
    contactpersonName: { type: String },
    mobileNumber: { type: String, required: true, unique: true },
    city: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "CityName",
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Category",
    },
    status: {
      type: String,
      required: true,
      enum: [
        "Fresh Data",
        "Appointment Generated",
        "Followup",
        "Not Interested",
        "Invalid Data",
        "Not Responding",
        "Deal Closed",
        "Visited",
      ],
    },
    followUpDate: { type: Date },
    source: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "leadsource",
    },
    remarks: { type: String },
    lead_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    appoint_to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    appointmentDate: {
      type: Date,
    },
    visit_result: {
      reason: { type: String },
      follow_up_date: { type: Date },
      visit_time: { type: String },
      update_location: {
        latitude: { type: String },
        longitude: { type: String },
      },
    },
  },
  {
    timestamps: true,
  }
);

businessSchema.set("toJSON", { virtuals: true });
businessSchema.set("toObject", { virtuals: true });

businessSchema.pre("save", function (next) {
  // Only generate a slug if it's not already set and if blogTitle is present
  if (!this.created_by) {
    this.created_by = mongoose.Types.ObjectId("66ffbdc11c350a415864d493");
  }
  next();
});

module.exports =
  mongoose.models.business || mongoose.model("business", businessSchema);
