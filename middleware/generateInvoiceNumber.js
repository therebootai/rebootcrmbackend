const invoiceCounter = require("../models/invoiceCounter");

const generateInvoiceNumber = async () => {
  let counter = await invoiceCounter.findOne();
  if (!counter) {
    counter = await invoiceCounter.create({ count: 1 });
  } else {
    counter.count += 1;
    await counter.save();
  }

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const datetime = `${month}A`;

  const paddedCount = String(counter.count).padStart(4, "0");

  return `RBI/${datetime}/${paddedCount}`;
};

module.exports = generateInvoiceNumber;
