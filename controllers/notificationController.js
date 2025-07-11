const notificationModel = require("../models/notificationModel");
const mongoose = require("mongoose");
exports.getNotifications = async (req, res) => {
  try {
    const {
      userId,
      type,
      startDate,
      endDate,
      limit = 20,
      page = 1,
    } = req.query;

    let filter = {};

    // Filter by userId if provided
    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res
          .status(400)
          .json({ message: "Invalid userId format.", success: false });
      }
      // The Notification model's userId field already stores the _id of the user (BDE, Telecaller, DM, or User)
      filter.userId = userId;
    }

    // Filter by notification type if provided
    if (type) {
      filter["customData.type"] = type; // Assuming 'type' is stored within customData
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.sentAt = {};
      if (startDate) {
        const startOfDay = new Date(startDate);
        startOfDay.setUTCHours(0, 0, 0, 0); // Start of the day in UTC
        filter.sentAt.$gte = startOfDay;
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setUTCHours(23, 59, 59, 999); // End of the day in UTC
        filter.sentAt.$lte = endOfDay;
      }
    }

    const pageNumber = Math.max(1, parseInt(page));
    const itemsPerPage = Math.max(1, parseInt(limit));
    const skip = (pageNumber - 1) * itemsPerPage;

    // Fetch notifications from the database
    const notifications = await notificationModel
      .find(filter)
      .sort({ sentAt: -1, createdAt: -1 }) // Sort by most recent first
      .skip(skip)
      .limit(itemsPerPage);

    const totalCount = await notificationModel.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    res.status(200).json({
      message: "Notifications fetched successfully.",
      notifications,
      totalCount,
      totalPages,
      currentPage: pageNumber,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      message: "Internal server error while fetching notifications.",
      success: false,
    });
  }
};
