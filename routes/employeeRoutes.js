const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employeeController");

router.post("/create", employeeController.createEmployee);
router.get("/get", employeeController.getEmployee);
router.get("/get/:employeeId", employeeController.getEmployeeById);

router.put("/update/:employeeId", employeeController.updateEmployee);
router.delete("/delete/:employeeId", employeeController.deleteEmployee);

module.exports = router;
