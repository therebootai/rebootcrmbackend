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
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  const datetime = `${day}${month}${year},${hours}${minutes}`;

  const paddedCount = String(counter.count).padStart(4, "0");

  return `RBT/${datetime}/${paddedCount}`;
};

module.exports = generateInvoiceNumber;
