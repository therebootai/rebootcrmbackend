const mongoose = require("mongoose");

const waimageSchema = new mongoose.Schema(
  {
    waimageId: {
      type: String,
      unique: true,
      required: true,
    },
    waimagename: {
      secure_url: { type: String, required: true },
      public_id: { type: String, required: true },
      original_filename: { type: String, required: true },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("WaImage", waimageSchema);
