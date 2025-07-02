const mongoose = require("mongoose");

const cleardAmountSchema = new mongoose.Schema({
  month: {
    type: String,
  },
  year: {
    type: Number,
  },
  amount: {
    type: Number,
  },
});

const emiSchema = new mongoose.Schema(
  {
    installmentNumber: {
      type: Number,
    },
    month: {
      type: String,
    },
    year: {
      type: Number,
    },
    amount: {
      type: Number,
    },
    due: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const monthlyPaymentAmountSchema = new mongoose.Schema({
  totalAmount: {
    type: Number,
  },
  emis: [emiSchema],
});

const clientSchema = new mongoose.Schema(
  {
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Client", clientSchema);
