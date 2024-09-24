const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const targetSchema = new Schema({
  month: { type: String },
  year: { type: Number },
  amount: { type: Number },
  achievement: { type: String },
});

const assignCategorySchema = new Schema({
  category: { type: String },
});

const assignCitySchema = new Schema({
  city: { type: String },
});

const createbusinessSchema = new Schema({
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
  followUpDate: { type: String },
  source: { type: String, required: true },
  remarks: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const bdeSchema = new Schema({
  bdeId: {
    type: String,
    unique: true,
    required: true,
  },
  bdename: { type: String, required: true },
  organizationrole: { type: String, required: true },
  mobileNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  status: { type: String, default: "active" },
  targets: [targetSchema],
  createdBusiness: { type: [createbusinessSchema], default: [] },
  assignCategories: { type: [assignCategorySchema], default: [] },
  assignCities: { type: [assignCitySchema], default: [] },
});

module.exports = mongoose.model("BDE", bdeSchema);
