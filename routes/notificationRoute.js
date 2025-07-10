const { getNotifications } = require("../controllers/notificationController");

const router = require("express").Router();

router.get("/", getNotifications);

module.exports = router;
