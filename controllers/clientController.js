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
    const { page = 1, limit = 20, search = "", bdeName, tmeLeads } = req.query;

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

exports.updateClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required",
      });
    }

    const updateData = req.body;

    const updatedClient = await ClientModel.findOneAndUpdate(
      { clientId },
      updateData,
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
