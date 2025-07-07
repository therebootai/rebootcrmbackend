const express = require("express");
const router = express.Router();
const {
  createClient,
  getClients,
  getCollectionSummary,
  updateClient,
  deleteClient,
  updateInvoice,
  updateInvoiceData,
  deleteInvoice,
} = require("../controllers/clientController");

router.post("/create", createClient);
router.get("/get", getClients);
router.get("/collection-summary", getCollectionSummary);
router.put("/update/:clientId", updateClient);
router.put("/update/:clientId/invoice", updateInvoice);
router.put("/update/:clientId/invoice/:invoiceId", updateInvoiceData);

router.delete("/delete/:clientId", deleteClient);
router.delete("/delete/:clientId/invoice/:invoiceId", deleteInvoice);

module.exports = router;
