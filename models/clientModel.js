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
const invoiceDataSchema = new mongoose.Schema({
  serviceName: {
    type: String,
  },
  productCode: {
    type: String,
  },
  quantity: {
    type: String,
  },
  rate: {
    type: String,
  },
  amount: {
    type: String,
  },
  description: {
    type: String,
  },
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
  },
  dueDate: {
    type: String,
  },
  isDraft: {
    type: Boolean,
    default: false,
  },
  previousPayment: { type: String },
  savePdf: {
    secure_url: {
      type: String,
    },
    public_id: {
      type: String,
    },
  },
  invoiceData: [invoiceDataSchema],
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
    ref: "User",
    required: false,
    default: null,
  },
  tmeLeads: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
    default: null,
  },
  dealAmount: {
    type: String,
  },
  cleardAmount: [cleardAmountSchema],
  monthlyPaymentAmount: [monthlyPaymentAmountSchema],
  remarks: { type: String },
  invoice: [invoiceSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Client", clientSchema);
