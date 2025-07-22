// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    designation: {
      type: String,
      required: true,
      enum: ["BDE", "Telecaller", "DigitalMarketer", "Admin", "HR"],
    },
    email: {
      type: String,
      unique: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    assignCategories: {
      type: [mongoose.Types.ObjectId],
      default: [],
      ref: "Category",
    },
    assignCities: {
      type: [mongoose.Types.ObjectId],
      default: [],
      ref: "CityName",
    },
    targets: [
      {
        month: { type: String },
        year: { type: Number },
        amount: { type: Number },
        achievement: { type: String },
        collection: { type: String },
      },
    ],
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
        status: {
          type: String,
          enum: ["present", "absent", "leave", "holiday"],
          default: "absent",
        },
        leave_reason: { type: String },
        leave_approval: {
          type: String,
          enum: ["approved", "rejected", "pending"],
          default: "pending",
        },
      },
    ],
    employee_ref: {
      type: mongoose.Types.ObjectId,
      ref: "Employee",
    },
    apptoken: {
      type: String,
      default: "",
    },
    status: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

module.exports = User;
