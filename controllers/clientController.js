const ClientModel = require("../models/clientModel");
const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequenceValue: { type: Number, required: true },
});

const Counter = mongoose.model("CounterClient", counterSchema);

const getNextSequenceValue = async (sequenceName) => {
  const sequenceDocument = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { sequenceValue: 1 } },
    { new: true, upsert: true }
  );
  return sequenceDocument.sequenceValue;
};

const generateClientId = async () => {
  let isUnique = false;
  let clientId = "";

  while (!isUnique) {
    const sequenceValue = await getNextSequenceValue("clientId");
    clientId = `clientId${String(sequenceValue).padStart(4, "0")}`;

    const existingBusiness = await ClientModel.findOne({ clientId });
    if (!existingBusiness) {
      isUnique = true;
    }
  }

  return clientId;
};

exports.createClient = async (req, res) => {
  try {
    const {
      businessName,
      serviceTaken,
      website,
      expiryDate,
      address,
      pincode,
      gstNo,
      bdeName,
      tmeLeads,
      dealAmount,
      cleardAmount,
      remarks,
    } = req.body;

    const clientId = await generateClientId();

    const newClient = new ClientModel({
      clientId,
      businessName,
      serviceTaken,
      website,
      expiryDate,
      address,
      pincode,
      gstNo,
      bdeName,
      tmeLeads,
      dealAmount,
      cleardAmount,
      remarks,
    });

    await newClient.save();

    return res.status(201).json({
      success: true,
      message: "Client created successfully",
      client: newClient,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating client",
      error: error.message,
    });
  }
};

exports.getClients = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      bdeName,
      tmeLeads,
      startDate,
      endDate,
    } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const matchStage = {};

    if (bdeName) {
      matchStage.bdeName = new mongoose.Types.ObjectId(bdeName);
    }

    if (tmeLeads) {
      matchStage.tmeLeads = new mongoose.Types.ObjectId(tmeLeads);
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      end.setHours(23, 59, 59, 999);

      matchStage.createdAt = { $gte: start, $lte: end };
    }
    const searchStage = [];
    if (search) {
      const isNumeric = /^\d+$/.test(search);
      searchStage.push({
        $match: {
          $or: isNumeric
            ? [{ "businessNameDoc.mobileNumber": search }]
            : [
                {
                  "businessNameDoc.buisnessname": {
                    $regex: search,
                    $options: "i",
                  },
                },
              ],
        },
      });
    }

    const pipeline = [
      {
        $lookup: {
          from: "businesses",
          localField: "businessName",
          foreignField: "_id",
          as: "businessNameDoc",
        },
      },
      { $unwind: "$businessNameDoc" },
      { $match: matchStage },
      ...searchStage,
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNumber },
            {
              $lookup: {
                from: "bdes",
                localField: "bdeName",
                foreignField: "_id",
                as: "bdeName",
              },
            },
            { $unwind: { path: "$bdeName", preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: "telecallers",
                localField: "tmeLeads",
                foreignField: "_id",
                as: "tmeLeads",
              },
            },
            {
              $unwind: { path: "$tmeLeads", preserveNullAndEmptyArrays: true },
            },
            {
              $addFields: {
                totalAmount: {
                  $add: [
                    {
                      $sum: "$cleardAmount.amount",
                    },
                    {
                      $sum: "$monthlyPaymentAmount.totalAmount",
                    },
                  ],
                },
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ];

    const result = await ClientModel.aggregate(pipeline);
    const clients = result[0].data;
    const totalCount = result[0].total[0]?.count || 0;

    res.status(200).json({
      success: true,
      data: clients,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalCount / limitNumber),
        totalClients: totalCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching clients",
      error: error.message,
    });
  }
};

const monthMap = {
  0: "January",
  1: "February",
  2: "March",
  3: "April",
  4: "May",
  5: "June",
  6: "July",
  7: "August",
  8: "September",
  9: "October",
  10: "November",
  11: "December",
};

exports.getCollectionSummary = async (req, res) => {
  try {
    const clients = await ClientModel.find(
      {},
      {
        cleardAmount: 1,
        monthlyPaymentAmount: 1,
      }
    );

    const summary = {};

    for (const client of clients) {
      for (const item of client.cleardAmount) {
        const date = new Date(item.createdAt);
        const year = date.getFullYear();
        const month = date.getMonth();
        const amount = item.amount || 0;

        if (!summary[year]) {
          summary[year] = Array(12).fill(0);
        }

        summary[year][month] += amount;
      }

      for (const item of client.monthlyPaymentAmount) {
        const date = new Date(item.createdAt);
        const year = date.getFullYear();
        const month = date.getMonth();
        const amount = item.totalAmount || 0;

        if (!summary[year]) {
          summary[year] = Array(12).fill(0);
        }

        summary[year][month] += amount;
      }
    }

    const finalOutput = Object.entries(summary).map(
      ([year, monthlyAmounts]) => ({
        year: Number(year),
        months: monthlyAmounts.map((amt, i) => ({
          month: monthMap[i],
          totalAmount: amt,
        })),
      })
    );

    return res.status(200).json({
      success: true,
      data: finalOutput,
    });
  } catch (error) {
    console.error("Error generating collection summary:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate summary",
      error: error.message,
    });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    const viewClient = await ClientModel.findOne({ clientId });

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required",
      });
    }

    const updateData = req.body;

    if (updateData.cleardAmount) {
      updateData.cleardAmount.forEach((item) => {
        if (item._id) {
          const existingItem = viewClient.cleardAmount.find(
            (i) => i._id.toString() === item._id.toString()
          );
          if (existingItem && existingItem.amount !== item.amount) {
            item.updatedAt = new Date();
          }
        } else {
          item.createdAt = new Date();
          item.updatedAt = new Date();
        }
      });
    }

    if (updateData.monthlyPaymentAmount) {
      updateData.monthlyPaymentAmount.forEach((item) => {
        if (item._id) {
          const existingItem = viewClient.monthlyPaymentAmount.find(
            (i) => i._id.toString() === item._id.toString()
          );
          if (existingItem && existingItem.totalAmount !== item.totalAmount) {
            item.updatedAt = new Date();
          }
        } else {
          item.createdAt = new Date();
          item.updatedAt = new Date();
        }
      });
    }

    const updatedClient = await ClientModel.findOneAndUpdate(
      { clientId },
      { $set: updateData },

      { new: true }
    )
      .populate("businessName")
      .populate("bdeName")
      .populate("tmeLeads");

    if (!updatedClient) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Client updated successfully",
      client: updatedClient,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error updating client",
      error: error.message,
    });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required",
      });
    }

    const deletedClient = await ClientModel.findOneAndDelete({ clientId });

    if (!deletedClient) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Client deleted successfully",
      client: deletedClient,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error deleting client",
      error: error.message,
    });
  }
};
