const mongoose = require("mongoose");

const citySchema = new mongoose.Schema(
  {
    cityId: {
      type: String,
      unique: true,
      required: true,
    },
    cityname: {
      type: String,
      unique: true,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CityName", citySchema);
