const express = require("express");
const router = express.Router();
const candidateController = require("../controllers/candidateController");

router.post("/create", candidateController.createCandidate);
router.get("/get", candidateController.getCandidate);
router.get("/get/:candidateId", candidateController.getCandidateById);
router.put("/update/:candidateId", candidateController.updateCandidate);
router.delete("/delete/:candidateId", candidateController.deleteCandidate);

module.exports = router;
