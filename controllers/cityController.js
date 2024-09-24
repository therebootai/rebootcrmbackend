const CityName = require("../models/cityModel");

const generateCityId = async () => {
  const city = await CityName.find({}, { cityId: 1, _id: 0 }).sort({
    cityId: 1,
  });
  const cityIds = city.map((city) =>
    parseInt(city.cityId.replace("cityId", ""), 10)
  );

  let cityId = 1;
  for (let i = 0; i < cityIds.length; i++) {
    if (cityId < cityIds[i]) {
      break;
    }
    cityId++;
  }

  return `cityId${String(cityId).padStart(4, "0")}`;
};

exports.createCity = async (req, res) => {
  try {
    const { cityname } = req.body;

    const cityId = await generateCityId();
    const newCity = new CityName({
      cityId,
      cityname,
    });

    await newCity.save();
    res.status(201).json({ message: "City created successfully", newCity });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      return res
        .status(400)
        .json({ error: "City already exists. Please try another name." });
    }
    console.error("Error creating City:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getCity = async (req, res) => {
  try {
    const citys = await CityName.find();
    res.status(200).json(citys);
  } catch (error) {
    console.error("Error fetching City:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateCity = async (req, res) => {
  try {
    const { cityId } = req.params;
    const { cityname } = req.body;

    // Find the college to update
    const cityUpdate = await CityName.findOne({ cityId });
    if (!cityUpdate) {
      return res.status(404).json({ message: "City not found" });
    }

    // Update college details
    cityUpdate.cityname = cityname || cityUpdate.cityname;

    // Save the updated college
    await cityUpdate.save();
    res.status(200).json({ message: "city updated successfully", cityUpdate });
  } catch (error) {
    console.error("Error updating City:", error.message);
    res.status(500).json({ message: "Error updating college", error });
  }
};

exports.deleteCity = async (req, res) => {
  try {
    const { cityId } = req.params;

    // Find brand to get public_id
    const cityDelete = await CityName.findOne({ cityId });
    if (!cityDelete) {
      return res.status(404).json({ message: "City not found" });
    }

    // Delete brand from database
    await CityName.findOneAndDelete({ cityId });
    res.status(200).json({ message: "City deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting college", error });
  }
};
