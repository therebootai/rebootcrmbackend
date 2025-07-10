const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // The _id of the user (BDE, Telecaller, DigitalMarketer, or generic User)
    // to whom the notification was intended. This allows querying notifications by recipient.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    topic: {
      type: String,
    },
    // The main title of the notification.
    title: {
      type: String,
      required: true,
    },
    // The main body/message of the notification.
    body: {
      type: String,
      required: true,
    },
    // Custom data payload sent with the notification.
    // Mongoose's Mixed type allows for flexible (schemaless) JSON objects.
    customData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Timestamp when the notification record was created in your database (i.e., when it was sent).
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Create and export the Mongoose model
module.exports = mongoose.model("Notification", notificationSchema);
