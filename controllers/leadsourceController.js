const Leadsource = require("../models/leadsourceModel");

const generateleadsourceId = async () => {
  const learsource = await Leadsource.find({}, { sourceId: 1, _id: 0 }).sort({
    sourceId: 1,
  });
  const sourceIds = learsource.map((learsource) =>
    parseInt(learsource.sourceId.replace("sourceId", ""), 10)
  );

  let sourceId = 1;
  for (let i = 0; i < sourceIds.length; i++) {
    if (sourceId < sourceIds[i]) {
      break;
    }
    sourceId++;
  }

  return `sourceId${String(sourceId).padStart(4, "0")}`;
};

exports.createSource = async (req, res) => {
  try {
    const { sourcename } = req.body;

    const sourceId = await generateleadsourceId();
    const newLeadsource = new Leadsource({
      sourceId,
      sourcename,
    });

    await newLeadsource.save();
    res
      .status(201)
      .json({ message: "LeadSource created successfully", newLeadsource });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      return res
        .status(400)
        .json({ error: "Source already exists. Please try another name." });
    }
    console.error("Error creating Source:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getSource = async (req, res) => {
  try {
    const leadsource = await Leadsource.find();
    res.status(200).json(leadsource);
  } catch (error) {
    console.error("Error fetching source:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateSource = async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { sourcename } = req.body;

    // Find the college to update
    const sourceUpdate = await Leadsource.findOne({ sourceId });
    if (!sourceUpdate) {
      return res.status(404).json({ message: "Source not found" });
    }

    // Update college details
    sourceUpdate.sourcename = sourcename || sourceUpdate.sourcename;

    // Save the updated college
    await sourceUpdate.save();
    res
      .status(200)
      .json({ message: "Source updated successfully", sourceUpdate });
  } catch (error) {
    console.error("Error updating course:", error.message);
    res.status(500).json({ message: "Error updating course", error });
  }
};

exports.deleteSource = async (req, res) => {
  try {
    const { sourceId } = req.params;

    // Find brand to get public_id
    const sourceDelete = await Leadsource.findOne({ sourceId });
    if (!sourceDelete) {
      return res.status(404).json({ message: "source not found" });
    }

    // Delete brand from database
    await Leadsource.findOneAndDelete({ sourceId });
    res.status(200).json({ message: "source deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting source", error });
  }
};
