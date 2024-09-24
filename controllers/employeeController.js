const { default: axios } = require("axios");
const Employee = require("../models/employeeModel");
const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const generateEmployeeId = async () => {
  const employees = await Employee.find({}, { employeeId: 1, _id: 0 }).sort({
    employeeId: 1,
  });
  const employeeIds = employees.map((employee) =>
    parseInt(employee.employeeId.replace("employeeId", ""), 10)
  );

  let employeeId = 1;
  for (let i = 0; i < employeeIds.length; i++) {
    if (employeeId < employeeIds[i]) {
      break;
    }
    employeeId++;
  }

  return `employeeId${String(employeeId).padStart(4, "0")}`;
};

const uploadPdfToCloudinary = async (file) => {
  if (!file || !file.tempFilePath) {
    throw new Error("No file provided or incorrect file path");
  }
  const result = await cloudinary.uploader.upload(file.tempFilePath, {
    resource_type: "auto", // For non-image files
    folder: "reboot",
  });
  return { secure_url: result.secure_url, public_id: result.public_id };
};

exports.createEmployee = async (req, res) => {
  try {
    const {
      employeename,
      mobileNumber,
      emergencyNumber,
      guardianName,
      role,
      type,
      joiningDate,
      status,
    } = req.body;

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send("No files were uploaded.");
    }

    const { govtId, experienceLetter, bankDetails, agreement } = req.files;

    const employeeId = await generateEmployeeId();

    const govtIdUpload = await uploadPdfToCloudinary(govtId);
    const experienceLetterUpload = experienceLetter
      ? await uploadPdfToCloudinary(experienceLetter)
      : null;
    const bankDetailsUpload = await uploadPdfToCloudinary(bankDetails);
    const agreementUpload = agreement
      ? await uploadPdfToCloudinary(agreement)
      : null;

    const newEmployee = new Employee({
      employeeId,
      employeename,
      mobileNumber,
      emergencyNumber,
      guardianName,
      role,
      type,
      govtId: govtIdUpload,
      experienceLetter: experienceLetterUpload,
      joiningDate,
      bankDetails: bankDetailsUpload,
      agreement: agreementUpload,
      status,
    });

    await newEmployee.save();

    res
      .status(201)
      .json({ message: "Employee created successfully", newEmployee });
  } catch (error) {
    console.error("Error creating Employee", error.message || error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getEmployee = async (req, res) => {
  try {
    const { date, role, status } = req.query;

    let filter = {};

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999); // Set end of the day for the date filter
      filter.joiningDate = { $gte: startDate, $lte: endDate };
    }
    if (role) filter.role = role;
    if (status) filter.status = status;

    const employees = await Employee.find(filter);

    res.status(200).json(employees);
  } catch (error) {
    console.error("Error fetching Employee", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json(employee);
  } catch (error) {
    console.error("Error fetching Employee:", error.message);
    res.status(500).json({ message: "Error fetching Employee", error });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const {
      employeename,
      mobileNumber,
      emergencyNumber,
      guardianName,
      role,
      type,
      joiningDate,
      status,
    } = req.body;

    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const { govtId, experienceLetter, bankDetails, agreement } =
      req.files || {};

    // Upload new files to Cloudinary if they exist
    const govtIdUpload = govtId ? await uploadPdfToCloudinary(govtId) : null;
    const experienceLetterUpload = experienceLetter
      ? await uploadPdfToCloudinary(experienceLetter)
      : null;
    const bankDetailsUpload = bankDetails
      ? await uploadPdfToCloudinary(bankDetails)
      : null;
    const agreementUpload = agreement
      ? await uploadPdfToCloudinary(agreement)
      : null;

    // Remove old files from Cloudinary if new ones are uploaded
    if (govtIdUpload && employee.govtId.public_id) {
      await cloudinary.uploader.destroy(employee.govtId.public_id);
      employee.govtId = govtIdUpload;
    }
    if (experienceLetterUpload && employee.experienceLetter.public_id) {
      await cloudinary.uploader.destroy(employee.experienceLetter.public_id);
      employee.experienceLetter = experienceLetterUpload;
    }
    if (bankDetailsUpload && employee.bankDetails.public_id) {
      await cloudinary.uploader.destroy(employee.bankDetails.public_id);
      employee.bankDetails = bankDetailsUpload;
    }
    if (agreementUpload && employee.agreement.public_id) {
      await cloudinary.uploader.destroy(employee.agreement.public_id);
      employee.agreement = agreementUpload;
    }

    // Update employee details
    employee.employeename = employeename || employee.employeename;
    employee.mobileNumber = mobileNumber || employee.mobileNumber;
    employee.emergencyNumber = emergencyNumber || employee.emergencyNumber;
    employee.guardianName = guardianName || employee.guardianName;
    employee.role = role || employee.role;
    employee.type = type || employee.type;
    employee.joiningDate = joiningDate || employee.joiningDate;
    employee.status = status || employee.status;

    await employee.save();

    res
      .status(200)
      .json({ message: "Employee updated successfully", employee });
  } catch (error) {
    console.error("Error updating Employee", error.message || error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await Employee.findOneAndDelete({ employeeId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Remove files from Cloudinary
    if (employee.govtId.public_id)
      await cloudinary.uploader.destroy(employee.govtId.public_id);
    if (employee.experienceLetter.public_id)
      await cloudinary.uploader.destroy(employee.experienceLetter.public_id);
    if (employee.bankDetails.public_id)
      await cloudinary.uploader.destroy(employee.bankDetails.public_id);
    if (employee.agreement.public_id)
      await cloudinary.uploader.destroy(employee.agreement.public_id);

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting Employee", error.message || error);
    res.status(500).json({ error: "Server error" });
  }
};
