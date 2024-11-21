const websiteLeads = require("../models/webSiteLeadsModel");

const generatewebsiteleadsId = async () => {
  const webSiteLeads = await websiteLeads
    .find({}, { webSiteleadsId: 1, _id: 0 })
    .sort({
      webSiteleadsId: 1,
    });
  const webSiteleadsIds = webSiteLeads.map((webSiteLeads) =>
    parseInt(webSiteLeads.webSiteleadsId.replace("webSiteleadsId", ""), 10)
  );

  let webSiteleadsId = 1;
  for (let i = 0; i < webSiteleadsIds.length; i++) {
    if (webSiteleadsId < webSiteleadsIds[i]) {
      break;
    }
    webSiteleadsId++;
  }

  return `webSiteleadsId${String(webSiteleadsId).padStart(4, "0")}`;
};

exports.createWebsiteLead = async (req, res) => {
  try {
    const webSiteleadsId = await generatewebsiteleadsId();
    const newLead = new websiteLeads({
      ...req.body,
      webSiteleadsId,
      status: "Fresh Data",
    });
    const savedLead = await newLead.save();
    res.status(201).json({
      success: true,
      message: "Lead created successfully",
      data: savedLead,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create lead",
      error: error.message,
    });
  }
};

exports.getWebsiteLeads = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      consultationFor,
      status,
      startDate,
      endDate,
    } = req.query;
    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { mobileNumber: { $regex: search, $options: "i" } },
      ];
    }
    if (consultationFor) {
      query.consultationFor = consultationFor;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      query.createdAt = {};

      if (start) {
        query.createdAt.$gte = new Date(start.setHours(0, 0, 0, 0));
      }

      if (end) {
        query.createdAt.$lt = new Date(end.setHours(23, 59, 59, 999));
      } else if (!end && start) {
        query.createdAt.$lt = new Date(start.setHours(23, 59, 59, 999));
      }
    }

    const totalLeads = await websiteLeads.countDocuments(query);

    const leadsData = await websiteLeads
      .find(query)
      .skip((pageInt - 1) * limitInt)
      .limit(limitInt)
      .sort({ createdAt: -1 });

    const totalPages = Math.ceil(totalLeads / limitInt);

    res.status(200).json({
      success: true,
      data: leadsData,
      currentPage: pageInt,
      totalPages,
      totalLeads,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve leads",
      error: error.message,
    });
  }
};

exports.getDropdownOptions = async (req, res) => {
  try {
    // Fetch unique values for consultationFor and status
    const consultationForOptions = await websiteLeads.distinct(
      "consultationFor"
    );
    const statusOptions = await websiteLeads.distinct("status");

    // Return options as a response
    res.status(200).json({
      success: true,
      consultationForOptions,
      statusOptions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch dropdown options",
      error: error.message,
    });
  }
};

exports.updateWebsiteLead = async (req, res) => {
  try {
    const { webSiteleadsId } = req.params; // Get the ID from the route params
    const updatedData = req.body; // The new data passed in the body, including 'status'

    // Update the lead document
    const updatedLead = await websiteLeads.findOneAndUpdate(
      { webSiteleadsId }, // Find the lead by its unique 'webSiteleadsId'
      updatedData, // The new data to update
      { new: true } // Return the updated document
    );

    if (!updatedLead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      data: updatedLead,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update lead",
      error: error.message,
    });
  }
};

exports.deleteWebsiteLead = async (req, res) => {
  try {
    const { webSiteleadsId } = req.params;

    const deletedLead = await websiteLeads.findOneAndDelete({ webSiteleadsId });

    if (!deletedLead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete lead",
      error: error.message,
    });
  }
};
