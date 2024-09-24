const mongoose = require("mongoose");

const leadsourceSchema = new mongoose.Schema(
  {
    sourceId: {
      type: String,
      unique: true,
      required: true,
    },
    sourcename: {
      type: String,
      unique: true,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("leadsource", leadsourceSchema);
