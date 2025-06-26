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

const digitalmarketerSchema = new Schema({
  digitalMarketerId: {
    type: String,
    unique: true,
    required: true,
  },
  digitalMarketername: { type: String, required: true },
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
      exit_time: { type: String },
      day_count: { type: String },
    },
  ],
});

module.exports = mongoose.model("digitalMarketer", digitalmarketerSchema);
