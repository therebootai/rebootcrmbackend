const express = require("express");
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
const businessModel = require("./models/businessModel");
const User = require("./models/user");

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
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
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
      throw new Error(
        "FCM message must specify a valid token or a valid topic."
      );
    }

    const response = await admin.messaging().send(message);

    // Save notification record to database
    await notificationModel.create({
      userId: userId,
      topic: topicForDb,
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
  const { targetUserId, targetFcmToken, topic, title, body, customData } =
    req.body;

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
  let topicForDb = null;

  try {
    if (targetUserId) {
      let user = await User.findOne({
        $or: [
          {
            _id: mongoose.Types.ObjectId.isValid(targetUserId)
              ? targetUserId
              : undefined,
          },
          { userId: targetUserId }, // Assuming a 'userId' field for lookup
        ],
      });

      if (!user || !user.apptoken) {
        return res.status(400).json({
          message: "User not found or no apptoken available for targetUserId.",
        });
      }
      target = user.apptoken;
      userIdForDb = user._id;
      topicForDb = null;
    } else if (targetFcmToken) {
      target = targetFcmToken;
      userIdForDb = null;
      topicForDb = null;
    } else if (topic) {
      target = topic;
      message.topic = topic;
      topicForDb = topic;
      userIdForDb = null;
    } else {
      return res.status(400).json({
        message: "No target (token or topic) specified for notification.",
      });
    }

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
  const checkTimeHour = 11;
  const checkTimeMinute = 30;
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
      console.log(
        "It's before 11:30 AM IST. No reminders sent yet by cron job."
      );
      return { message: "It's before 11:30 AM IST. No reminders sent yet." };
    }

    // Find all users who are not Admin or HR and have an apptoken
    const users = await User.find({
      designation: { $nin: ["Admin", "HR"] },
      apptoken: { $exists: true },
    });

    const usersToNotify = [];

    for (const user of users) {
      if (!user.attendence_list || !Array.isArray(user.attendence_list)) {
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
          appToken: user.apptoken,
        });
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
      return sendFCMNotification(user.appToken, message, user.userId, null);
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

app.post("/api/check-and-notify-late-checkins", async (req, res) => {
  const result = await checkAndNotifyLateCheckinsLogic();
  if (result.error) {
    res.status(500).json(result);
  } else {
    res.status(200).json(result);
  }
});

const sendFollowupAndAppointmentRemindersLogic = async () => {
  const notificationTitle = "Today's Follow-up & Appointment Reminders";

  try {
    console.log(
      "Running scheduled follow-up and appointment reminders at 10:30 AM IST..."
    );

    const todayIST = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    todayIST.setHours(0, 0, 0, 0);

    const tomorrowIST = new Date(todayIST);
    tomorrowIST.setDate(tomorrowIST.getDate() + 1);

    const notificationPromises = [];

    const users = await User.find({
      designation: { $in: ["BDE", "Telecaller", "DigitalMarketer"] },
      status: "active",
      apptoken: { $exists: true },
    });

    for (const user of users) {
      let filter = {
        $and: [
          {
            $or: [
              { followUpDate: { $gte: todayIST, $lt: tomorrowIST } },
              { appointmentDate: { $gte: todayIST, $lt: tomorrowIST } },
            ],
          },
          {
            $or: [
              { status: "Followup" },
              { "visit_result.reason": "Followup" },
              { status: "Appointment Generated" },
            ],
          },
        ],
      };

      // Use a consistent field name for user assignment, for example, `assignedUser`
      // Or, if you need to use the `designation` as part of the filter, you can.
      // Assuming a `userId` field on the businessModel that stores the _id of the assigned user.
      filter.$and.push({ userId: user._id });

      const followupCount = await businessModel.countDocuments({
        ...filter,
        $and: [
          ...filter.$and,
          {
            $or: [
              { status: "Followup" },
              { "visit_result.reason": "Followup" },
            ],
          },
        ],
      });

      const appointmentCount = await businessModel.countDocuments({
        ...filter,
        $and: [...filter.$and, { status: "Appointment Generated" }],
      });

      if (followupCount > 0 || appointmentCount > 0) {
        const body = `You have ${followupCount} follow-ups and ${appointmentCount} appointments scheduled for today.`;
        const message = {
          notification: { title: notificationTitle, body: body },
          data: {
            type: "followup_appointment_reminder",
            followups: String(followupCount),
            appointments: String(appointmentCount),
            userId: String(user._id),
          },
        };
        notificationPromises.push(
          sendFCMNotification(user.apptoken, message, user._id, null)
        );
      }
    }

    const results = await Promise.allSettled(notificationPromises);

    const successfulSends = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const failedSends = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && !r.value.success)
    ).length;

    console.log(
      `Attempted to send reminders. Successful: ${successfulSends}, Failed: ${failedSends}`
    );
    return {
      message: `Attempted to send reminders.`,
      successfulSends,
      failedSends,
    };
  } catch (error) {
    console.error("Error in sendFollowupAndAppointmentRemindersLogic:", error);
    return {
      message: "Internal server error during reminder process.",
      error: error.message,
    };
  }
};

app.post("/api/send-followup-reminders", async (req, res) => {
  const result = await sendFollowupAndAppointmentRemindersLogic();
  if (result.error) {
    res.status(500).json(result);
  } else {
    res.status(200).json(result);
  }
});

cron.schedule(
  "30 10 * * *",
  async () => {
    console.log(
      "Running scheduled follow-up and appointment reminder at 10:30 AM IST..."
    );
    await sendFollowupAndAppointmentRemindersLogic();
  },
  {
    timezone: "Asia/Kolkata", // Explicitly set timezone for cron job
  }
);

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
