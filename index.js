const express = require("express");
const router = express.Router();
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const MongoDbConnect = require("./connection");
const fileUpload = require("express-fileupload");
require("dotenv").config();
const port = process.env.PORT;
MongoDbConnect();

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

app.listen(port, () => {
  console.log(`Port starts on  ${port}`);
});
