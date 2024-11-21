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

    // Convert page and limit to integers
    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);

    // Build query object dynamically
    let query = {};

    // Search by name or mobileNumber
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } }, // Case-insensitive search for name
        { mobileNumber: { $regex: search, $options: "i" } }, // Partial match for mobileNumber
      ];
    }

    // Filter by consultationFor
    if (consultationFor) {
      query.consultationFor = consultationFor;
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Get total count of leads matching the query
    const totalLeads = await websiteLeads.countDocuments(query);

    // Fetch leads with pagination
    const leadsData = await websiteLeads
      .find(query)
      .skip((pageInt - 1) * limitInt)
      .limit(limitInt)
      .sort({ createdAt: -1 }); // Sort by createdAt (latest first)

    // Calculate total pages
    const totalPages = Math.ceil(totalLeads / limitInt);

    // Return response
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
