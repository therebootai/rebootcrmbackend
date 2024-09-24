const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employeeController");

router.post("/create", employeeController.createEmployee);
router.get("/get", employeeController.getEmployee);
router.get("/get/:employeeId", employeeController.getEmployeeById);

router.put("/update/:employeeId", employeeController.updateEmployee);
router.delete("/delete/:employeeId", employeeController.deleteEmployee);

module.exports = router;

// // exports.updateEmployee = async (req, res) => {
//   try {
//     const { candidateId } = req.params;
//     const {
//       employeename,
//       mobileNumber,
//       emergencyNumber,
//       guardianName,
//       role,
//       type,
//       govtId,
//       experienceLetter,
//       joiningDate,
//       bankDetails,
//       agreement,
//       status,
//     } = req.body;

//     const employee = await Employee.findOne({ candidateId });

//     if (!employee) {
//       return res.status(404).json({ error: "Employee not found" });
//     }

//     // Upload new PDFs and delete old ones if they exist
//     if (govtId) {
//       await deletePdfFromCloudinary(
//         employee.govtId.split("/").pop().split(".")[0]
//       );
//       const govtIdUpload = await uploadPdfToCloudinary(govtId.path);
//       employee.govtId = govtIdUpload.secure_url;
//     }

//     if (experienceLetter) {
//       await deletePdfFromCloudinary(
//         employee.experienceLetter.split("/").pop().split(".")[0]
//       );
//       const experienceLetterUpload = await uploadPdfToCloudinary(
//         experienceLetter.path
//       );
//       employee.experienceLetter = experienceLetterUpload.secure_url;
//     }

//     if (bankDetails) {
//       await deletePdfFromCloudinary(
//         employee.bankDetails.split("/").pop().split(".")[0]
//       );
//       const bankDetailsUpload = await uploadPdfToCloudinary(bankDetails.path);
//       employee.bankDetails = bankDetailsUpload.secure_url;
//     }

//     if (agreement) {
//       await deletePdfFromCloudinary(
//         employee.agreement.split("/").pop().split(".")[0]
//       );
//       const agreementUpload = await uploadPdfToCloudinary(agreement.path);
//       employee.agreement = agreementUpload.secure_url;
//     }

//     // Update other fields
//     employee.employeename = employeename;
//     employee.mobileNumber = mobileNumber;
//     employee.emergencyNumber = emergencyNumber;
//     employee.guardianName = guardianName;
//     employee.role = role;
//     employee.type = type;
//     employee.joiningDate = joiningDate;
//     employee.status = status;

//     await employee.save();

//     res
//       .status(200)
//       .json({ message: "Employee updated successfully", employee });
//   } catch (error) {
//     console.error("Error updating Employee", error.message);
//     res.status(500).json({ error: "Server error" });
//   }
// };
// //
