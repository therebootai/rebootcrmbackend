const mongoose = require("mongoose");

const invoiceCounterSchema = new mongoose.Schema({
  count: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("invoiceCounter", invoiceCounterSchema);
