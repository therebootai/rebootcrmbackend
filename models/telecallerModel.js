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

const telecallerSchema = new Schema({
  telecallerId: {
    type: String,
    unique: true,
    required: true,
  },
  telecallername: { type: String, required: true },
  organizationrole: { type: String, required: true },
  mobileNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  status: { type: String, default: "active" },
  targets: [targetSchema],

  assignCategories: { type: [assignCategorySchema], default: [] },
  assignCities: { type: [assignCitySchema], default: [] },
  attendence_list: [
    {
      date: { type: Date, default: Date.now },
      entry_time: { type: String },
      entry_time_location: {
        type: {
          latitude: { type: String },
          longitude: { type: String },
        },
      },
      exit_time: { type: String },
      exit_time_location: {
        type: {
          latitude: { type: String },
          longitude: { type: String },
        },
      },
      day_count: { type: String },
      status: { type: String, enum: ["present", "absent", "leave", "holiday"] },
      leave_reason: { type: String },
      leave_approval: {
        type: String,
        enum: ["approved", "rejected", "pending"],
        default: "pending",
      },
    },
  ],
  created_business: {
    type: [mongoose.Types.ObjectId],
    default: [],
    ref: "business",
  },
  employee_ref: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "Employee",
  },
  apptoken: {
    type: String,
    default: "",
  },
});

module.exports = mongoose.model("Telecaller", telecallerSchema);
