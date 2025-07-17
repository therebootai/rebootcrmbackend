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
  try {
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      resource_type: "auto", // For non-image files
      folder: "reboot",
    });
    return { secure_url: result.secure_url, public_id: result.public_id };
  } catch (error) {
    throw error;
  }
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

    const { govtId, experienceLetter, bankDetails, agreement, profile_img } =
      req.files;

    const newPromises = [generateEmployeeId()];

    if (govtId) {
      newPromises.push(uploadPdfToCloudinary(govtId));
    }

    if (experienceLetter) {
      newPromises.push(uploadPdfToCloudinary(experienceLetter));
    }

    if (bankDetails) {
      newPromises.push(uploadPdfToCloudinary(bankDetails));
    }

    if (agreement) {
      newPromises.push(uploadPdfToCloudinary(agreement));
    }

    if (profile_img) {
      newPromises.push(uploadPdfToCloudinary(profile_img));
    }

    const [
      employeeId,
      govtIdUpload,
      experienceLetterUpload,
      bankDetailsUpload,
      agreementUpload,
      profile_imgUpload,
    ] = await Promise.all(newPromises);

    const newEmployee = new Employee({
      employeeId,
      employeename,
      mobileNumber,
      emergencyNumber,
      guardianName,
      role,
      type,
      profile_img: profile_imgUpload,
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
    console.error("Error creating Employee:", error.message || error);

    if (error.code === 11000) {
      // Duplicate key error
      if (error.keyPattern && error.keyPattern.mobileNumber) {
        return res.status(400).json({ error: "Mobile number already exists" });
      } else if (error.keyPattern && error.keyPattern.emergencyNumber) {
        return res
          .status(400)
          .json({ error: "Emergency mobile number already exists" });
      }
    }

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

    const { govtId, experienceLetter, bankDetails, agreement, profile_img } =
      req.files || {};

    const promisesMap = {};
    if (govtId) {
      promisesMap.govtId = uploadPdfToCloudinary(govtId);
    }
    if (experienceLetter) {
      promisesMap.experienceLetter = uploadPdfToCloudinary(experienceLetter);
    }
    if (bankDetails) {
      promisesMap.bankDetails = uploadPdfToCloudinary(bankDetails);
    }
    if (agreement) {
      promisesMap.agreement = uploadPdfToCloudinary(agreement);
    }
    if (profile_img) {
      promisesMap.profile_img = uploadPdfToCloudinary(profile_img);
    }

    const keys = Object.keys(promisesMap);
    const uploadedFiles = await Promise.all(Object.values(promisesMap));

    const uploadResults = {};
    for (let i = 0; i < keys.length; i++) {
      uploadResults[keys[i]] = uploadedFiles[i];
    }

    // You now access the results by name
    const govtIdUpload = uploadResults.govtId;
    const experienceLetterUpload = uploadResults.experienceLetter;
    const bankDetailsUpload = uploadResults.bankDetails;
    const agreementUpload = uploadResults.agreement;
    const profile_imgUpload = uploadResults.profile_img;

    // Remove old files and update the employee object
    if (govtIdUpload && employee.govtId && employee.govtId.public_id) {
      await cloudinary.uploader.destroy(employee.govtId.public_id);
      employee.govtId = govtIdUpload;
    } else if (govtIdUpload) {
      employee.govtId = govtIdUpload;
    }

    if (
      experienceLetterUpload &&
      employee.experienceLetter &&
      employee.experienceLetter.public_id
    ) {
      await cloudinary.uploader.destroy(employee.experienceLetter.public_id);
      employee.experienceLetter = experienceLetterUpload;
    } else if (experienceLetterUpload) {
      employee.experienceLetter = experienceLetterUpload;
    }

    if (
      bankDetailsUpload &&
      employee.bankDetails &&
      employee.bankDetails.public_id
    ) {
      await cloudinary.uploader.destroy(employee.bankDetails.public_id);
      employee.bankDetails = bankDetailsUpload;
    } else if (bankDetailsUpload) {
      employee.bankDetails = bankDetailsUpload;
    }

    if (agreementUpload && employee.agreement && employee.agreement.public_id) {
      await cloudinary.uploader.destroy(employee.agreement.public_id);
      employee.agreement = agreementUpload;
    } else if (agreementUpload) {
      employee.agreement = agreementUpload;
    }

    if (
      profile_imgUpload &&
      employee.profile_img &&
      employee.profile_img.public_id
    ) {
      await cloudinary.uploader.destroy(employee.profile_img.public_id);
      employee.profile_img = profile_imgUpload;
    } else if (profile_imgUpload) {
      employee.profile_img = profile_imgUpload;
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
    if (employee.profile_img.public_id)
      await cloudinary.uploader.destroy(employee.profile_img.public_id);

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting Employee", error.message || error);
    res.status(500).json({ error: "Server error" });
  }
};
