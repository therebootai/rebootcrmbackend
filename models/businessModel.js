const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const businessSchema = new Schema({
  businessId: {
    type: String,
    unique: true,
    required: true,
  },
  buisnessname: { type: String, required: true },
  contactpersonName: { type: String },
  mobileNumber: { type: String, required: true, unique: true },
  city: { type: String, required: true },
  category: { type: String, required: true },
  status: { type: String, required: true },
  followUpDate: { type: Date },
  source: { type: String, required: true },
  remarks: { type: String },
  telecallerId: { type: String },
  digitalMarketerId: { type: String },
  bdeId: { type: String },
  createdAt: { type: Date, default: Date.now },
  tagAppointment: {
    type: String,
  },
  appointmentDate: {
    type: Date,
  },
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

businessSchema.virtual("formattedCreatedAt").get(function () {
  return formatDate(this.createdAt);
});

businessSchema.set("toJSON", { virtuals: true });
businessSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("business", businessSchema);
