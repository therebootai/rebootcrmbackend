const express = require("express");
const router = express.Router();
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const MongoDbConnect = require("./connection");
const fileUpload = require("express-fileupload");
const path = require("path");
const admin = require("firebase-admin");
const cron = require("node-cron");
const mongoose = require("mongoose");
require("dotenv").config();
const port = process.env.PORT;
MongoDbConnect();

try {
  const serviceAccount = require(path.resolve(
    __dirname,
    "./reboot-app-f0f36-firebase-adminsdk-fbsvc-1b201286b1.json"
  ));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // You might need to specify databaseURL if you're using Realtime Database or Firestore
    // databaseURL: "https://<YOUR_PROJECT_ID>.firebaseio.com"
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error.message);
  console.error(
    "Please ensure your service account key path is correct and the file exists."
  );
  process.exit(1); // Exit if Firebase fails to initialize, as notifications won't work
}

const cityRoutes = require("./routes/cityRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const leadsourceRoutes = require("./routes/leadsourceRoutes");
const businessRoutes = require("./routes/businessRoutes");
const candidateRoutes = require("./routes/candidateRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const telecallerRoutes = require("./routes/telecallerRoutes");
const digitalMarketerRoutes = require("./routes/digitalMarketerRoutes");
const bdeRoutes = require("./routes/bdeRoutes");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const waimageRoutes = require("./routes/waimageRoutes");
const webSiteLeadsRoutes = require("./routes/webSiteLeadsRoutes");
const blogRoutes = require("./routes/blogRoutes");
const careerJobPostRoutes = require("./routes/careerJobPostRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const clientRoute = require("./routes/clientRoutes");
const notificationRoutes = require("./routes/notificationRoute");
const bdeModel = require("./models/bdeModel");
const telecallerModel = require("./models/telecallerModel");
const digitalMarketerModel = require("./models/digitalMarketerModel");
const notificationModel = require("./models/notificationModel");

app.use(cors());

app.use(express.json());

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use("/api/city", cityRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/source", leadsourceRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/candidate", candidateRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/telecaller", telecallerRoutes);
app.use("/api/digitalmarketer", digitalMarketerRoutes);
app.use("/api/bde", bdeRoutes);
app.use("/api", userRoutes);
app.use("/api", authRoutes);
app.use("/api/waimage", waimageRoutes);
app.use("/api/websiteleads", webSiteLeadsRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/jobpost", careerJobPostRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/client", clientRoute);
app.use("/api/notifications", notificationRoutes);

const sendFCMNotification = async (
  targetTokenOrTopic,
  message,
  userId = null,
  topicForDb = null
) => {
  try {
    if (
      !message ||
      typeof message !== "object" ||
      (!message.notification && !message.data)
    ) {
      throw new Error(
        "FCM message object is invalid or missing notification/data payload."
      );
    }

    // Determine the actual target for FCM and set it on the message object
    if (
      topicForDb &&
      typeof topicForDb === "string" &&
      topicForDb.trim() !== ""
    ) {
      message.topic = topicForDb;
      delete message.token; // Ensure 'token' is not present if 'topic' is used
    } else if (
      targetTokenOrTopic &&
      typeof targetTokenOrTopic === "string" &&
      targetTokenOrTopic.trim() !== ""
    ) {
      message.token = targetTokenOrTopic; // Set the token
      delete message.topic; // Ensure 'topic' is not present if 'token' is used
    } else {
      // If neither a valid topic nor a valid token is provided, throw an error
      throw new Error(
        "FCM message must specify a valid token or a valid topic."
      );
    }

    // Optional: Uncomment for debugging the final message object before sending
    // console.log('FCM Message object before sending:', JSON.stringify(message, null, 2));

    // Always use admin.messaging().send()
    const response = await admin.messaging().send(message);
    console.log("Successfully sent message:", response);

    // Save notification record to database
    await notificationModel.create({
      userId: userId,
      topic: topicForDb, // Store the topic if it was a topic message
      title: message.notification?.title || "No Title",
      body: message.notification?.body || "No Body",
      customData: message.data,
      sentAt: new Date(),
    });
    console.log("Notification record saved to database.");

    return { success: true, response };
  } catch (error) {
    console.error("Error sending notification:", error);
    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      console.warn(
        `Invalid or expired FCM token for target: ${targetTokenOrTopic}. Consider removing from database.`
      );
      // Implement logic to remove invalid token from your database here
    }
    // Still attempt to save a record even if FCM send fails
    try {
      await notificationModel.create({
        userId: userId,
        topic: topicForDb,
        title: message.notification?.title || "No Title",
        body: message.notification?.body || "No Body",
        customData: {
          ...message.data,
          fcmError: error.message,
          fcmErrorCode: error.code,
        },
        sentAt: new Date(),
      });
      console.log("Failed notification record saved to database.");
    } catch (dbError) {
      console.error(
        "Error saving failed notification record to database:",
        dbError
      );
    }

    return { success: false, error: error.message };
  }
};

app.post("/api/send-notification", async (req, res) => {
  const {
    targetUserId,
    targetFcmToken, // This parameter name remains for external API consistency
    topic,
    title,
    body,
    customData,
  } = req.body;

  let message = {
    notification: {
      title: title || "New Notification",
      body: body || "You have a new update!",
    },
    data: {
      type: customData?.type || "general",
      entityId: customData?.entityId || "",
      ...Object.fromEntries(
        Object.entries(customData || {}).map(([key, value]) => [
          key,
          String(value),
        ])
      ),
    },
  };

  let target;
  let userIdForDb = null;
  // MODIFIED: Removed appTokenForDb declaration
  let topicForDb = null;

  try {
    if (targetUserId) {
      let user;
      user =
        (await bdeModel.findOne({
          $or: [
            { bdeId: targetUserId },
            {
              _id: mongoose.Types.ObjectId.isValid(targetUserId)
                ? targetUserId
                : undefined,
            },
          ],
        })) ||
        (await telecallerModel.findOne({
          $or: [
            { telecallerId: targetUserId },
            {
              _id: mongoose.Types.ObjectId.isValid(targetUserId)
                ? targetUserId
                : undefined,
            },
          ],
        })) ||
        (await digitalMarketerModel.findOne({
          $or: [
            { digitalMarketerId: targetUserId },
            {
              _id: mongoose.Types.ObjectId.isValid(targetUserId)
                ? targetUserId
                : undefined,
            },
          ],
        }));

      console.log(user);

      if (!user || !user.apptoken) {
        return res.status(400).json({
          message: "User not found or no apptoken available for targetUserId.",
        });
      }
      target = user.apptoken;
      userIdForDb = user._id; // Capture userId for DB storage
      // MODIFIED: Removed appTokenForDb assignment
      topicForDb = null; // Ensure topic is null if sending to a specific user
    } else if (targetFcmToken) {
      // Keep this for direct token input if needed
      target = targetFcmToken;
      // MODIFIED: Removed appTokenForDb assignment
      userIdForDb = null; // Ensure userId is null if sending directly to a token
      topicForDb = null; // Ensure topic is null if sending directly to a token
    } else if (topic) {
      target = topic;
      message.topic = topic;
      topicForDb = topic; // Capture topic for DB storage
      userIdForDb = null; // Ensure userId is null if sending to a topic
      // MODIFIED: Removed appTokenForDb assignment
    } else {
      return res.status(400).json({
        message: "No target (token or topic) specified for notification.",
      });
    }

    // MODIFIED: Removed appTokenForDb from parameters passed to sendFCMNotification
    const result = await sendFCMNotification(
      target,
      message,
      userIdForDb,
      topicForDb
    );

    if (result.success) {
      res.status(200).json({
        message: "Notification sent successfully!",
        response: result.response,
      });
    } else {
      res
        .status(500)
        .json({ message: "Failed to send notification.", error: result.error });
    }
  } catch (error) {
    console.error("Error in /api/send-notification route:", error);
    res
      .status(500)
      .json({ message: "Internal server error.", error: error.message });
  }
});

const checkAndNotifyLateCheckinsLogic = async () => {
  const checkTimeHour = 11; // 12 PM
  const checkTimeMinute = 30; // 0 minutes
  const notificationTitle = "Reminder: Check-in Time!";
  const notificationBody =
    "It's past 11:30 AM. Please remember to check in for today's attendance.";
  const notificationCustomData = { type: "checkin_reminder", urgency: "high" };

  try {
    const now = new Date();
    const todayIST = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    todayIST.setHours(0, 0, 0, 0);

    const cutoffTimeIST = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    cutoffTimeIST.setHours(checkTimeHour, checkTimeMinute, 0, 0);

    if (now.getTime() < cutoffTimeIST.getTime()) {
      console.log("It's before 12 PM IST. No reminders sent yet by cron job.");
      return { message: "It's before 12 PM IST. No reminders sent yet." };
    }

    const usersToNotify = [];
    const userModels = [bdeModel, telecallerModel, digitalMarketerModel];

    for (const Model of userModels) {
      const users = await Model.find({});

      for (const user of users) {
        if (
          !user.attendence_list ||
          !Array.isArray(user.attendence_list) ||
          !user.apptoken
        ) {
          continue;
        }

        const todayAttendance = user.attendence_list.find((att) => {
          if (!att.date) return false;
          const attDateIST = new Date(
            att.date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
          );
          attDateIST.setHours(0, 0, 0, 0);
          return attDateIST.getTime() === todayIST.getTime();
        });

        let needsNotification = false;
        if (!todayAttendance || !todayAttendance.entry_time) {
          needsNotification = true;
        } else {
          const entryTimeDate = new Date(
            todayAttendance.entry_time.toLocaleString("en-US", {
              timeZone: "Asia/Kolkata",
            })
          );
          if (
            entryTimeDate.getHours() > checkTimeHour ||
            (entryTimeDate.getHours() === checkTimeHour &&
              entryTimeDate.getMinutes() >= checkTimeMinute)
          ) {
            needsNotification = true;
          }
        }

        if (needsNotification) {
          usersToNotify.push({
            userId: user._id,
            appToken: user.apptoken, // Still need appToken here to target the device
          });
        }
      }
    }

    if (usersToNotify.length === 0) {
      console.log(
        "All users have checked in on time or no users found to notify."
      );
      return {
        message:
          "All users have checked in on time or no users found to notify.",
      };
    }

    const notificationPromises = usersToNotify.map((user) => {
      const message = {
        notification: { title: notificationTitle, body: notificationBody },
        data: {
          ...notificationCustomData,
          userId: String(user.userId),
        },
      };
      // MODIFIED: Removed appToken from parameters passed to sendFCMNotification
      return sendFCMNotification(user.appToken, message, user.userId, null); // topic is null for direct token
    });

    const results = await Promise.allSettled(notificationPromises);

    const successfulSends = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const failedSends = results.filter(
      (r) => r.status === "rejected" || !r.value.success
    ).length;

    console.log(
      `Attempted to send notifications to ${usersToNotify.length} users. Successful: ${successfulSends}, Failed: ${failedSends}`
    );
    return {
      message: `Attempted to send notifications to ${usersToNotify.length} users.`,
      successfulSends,
      failedSends,
      details: results.map((r) => ({
        status: r.status,
        reason: r.reason?.message || r.value?.error,
      })),
    };
  } catch (error) {
    console.error("Error in checkAndNotifyLateCheckinsLogic:", error);
    return {
      message:
        "Internal server error during late check-in notification process.",
      error: error.message,
    };
  }
};

// --- NEW ROUTE: Identify and Notify Late Check-ins (now calls the encapsulated logic) ---
app.post("/api/check-and-notify-late-checkins", async (req, res) => {
  const result = await checkAndNotifyLateCheckinsLogic();
  if (result.error) {
    res.status(500).json(result);
  } else {
    res.status(200).json(result);
  }
});

cron.schedule(
  "30 11 * * *",
  async () => {
    console.log("Running scheduled check-in reminder at 11:30 AM IST...");
    await checkAndNotifyLateCheckinsLogic();
  },
  {
    timezone: "Asia/Kolkata", // Explicitly set timezone for cron job
  }
);

app.listen(port, () => {
  console.log(`Port starts on  ${port}`);
});
