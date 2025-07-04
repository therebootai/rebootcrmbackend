const mongoose = require("mongoose");

const cleardAmountSchema = new mongoose.Schema({
  amount: {
    type: Number,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const monthlyPaymentAmountSchema = new mongoose.Schema({
  totalAmount: {
    type: Number,
  },
  serviceName: {
    type: String,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const clientSchema = new mongoose.Schema({
  clientId: {
    type: String,
    unique: true,
    required: true,
  },
  businessName: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "business",
    required: true,
  },
  serviceTaken: {
    type: String,
  },
  website: {
    type: String,
  },
  expiryDate: {
    type: Date,
  },
  address: {
    type: String,
  },
  pincode: {
    type: String,
  },
  gstNo: {
    type: String,
  },
  bdeName: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BDE",
    required: false,
    default: null,
  },
  tmeLeads: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Telecaller",
    required: false,
    default: null,
  },
  dealAmount: {
    type: String,
  },
  cleardAmount: [cleardAmountSchema],
  monthlyPaymentAmount: [monthlyPaymentAmountSchema],
  remarks: { type: String },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Client", clientSchema);
