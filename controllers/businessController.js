const business = require("../models/businessModel");
const Telecaller = require("../models/telecallerModel");
const BDE = require("../models/bdeModel");
const DigitalMarketer = require("../models/digitalMarketerModel");
const path = require("path");
const fs = require("fs");
const fastcsv = require("fast-csv");

const mongoose = require("mongoose");

// Counter Schema for generating unique business IDs
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequenceValue: { type: Number, required: true },
});

const Counter = mongoose.model("Counter", counterSchema);

// Function to get the next sequence value
const getNextSequenceValue = async (sequenceName) => {
  const sequenceDocument = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { sequenceValue: 1 } },
    { new: true, upsert: true }
  );
  return sequenceDocument.sequenceValue;
};

// Enhanced function to generate a unique business ID
const generatebusinessId = async () => {
  let isUnique = false;
  let businessId = "";

  while (!isUnique) {
    const sequenceValue = await getNextSequenceValue("businessId");
    businessId = `businessId${String(sequenceValue).padStart(4, "0")}`;

    // Check if the generated businessId already exists in the database
    const existingBusiness = await business.findOne({ businessId });
    if (!existingBusiness) {
      isUnique = true; // If no duplicate is found, exit the loop
    }
  }

  return businessId;
};

exports.createBusiness = async (req, res) => {
  try {
    const {
      buisnessname,
      contactpersonName,
      mobileNumber,
      city,
      category,
      status,
      followUpDate,
      source,
      telecallerId,
      digitalMarketerId,
      bdeId,
      remarks,
      createdBy,
      creatorModel,
    } = req.body;

    const businessId = await generatebusinessId();

    const newBusiness = new business({
      businessId,
      buisnessname,
      contactpersonName,
      mobileNumber,
      city,
      category,
      status,
      followUpDate,
      source,
      remarks,
      telecallerId: telecallerId || null,
      digitalMarketerId: digitalMarketerId || null,
      bdeId: bdeId || null,
      createdBy,
      creatorModel,
    });

    await newBusiness.save();

    if (telecallerId) {
      const telecaller = await Telecaller.findOne({ telecallerId });

      if (telecaller) {
        await telecaller.save();
      } else {
        return res.status(404).json({ message: "Telecaller not found" });
      }
    }
    if (digitalMarketerId) {
      const digitalMarketer = await DigitalMarketer.findOne({
        digitalMarketerId,
      });

      if (digitalMarketer) {
        await digitalMarketer.save();
      } else {
        return res.status(404).json({ message: "digitalMarketer not found" });
      }
    }
    if (bdeId) {
      const bdes = await BDE.findOne({
        bdeId,
      });

      if (bdes) {
        await bdes.save();
      } else {
        return res.status(404).json({ message: "bde not found" });
      }
    }

    res
      .status(201)
      .json({ message: "Business created successfully", newBusiness });
  } catch (error) {
    console.error("Error creating Business", error.message);
    if (error.code === 11000) {
      res.status(400).json({ error: "Mobile number already exists" });
    } else {
      res.status(500).json({ error: "Server error" });
    }
  }
};
// Fetch businesses with filtering based on telecallerId, category, and city
exports.getBusiness = async (req, res) => {
  try {
    const {
      mobileNumber,
      city,
      category,
      status,
      source,
      telecallerId,
      bdeId,
      byTagAppointment,
      digitalMarketerId,
      followupstartdate,
      followupenddate,
      appointmentstartdate,
      appointmentenddate,
      createdstartdate,
      createdenddate,
      businessname,
      appointmentDate,
    } = req.query;

    const limit =
      parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 20;
    const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;

    let filter = {};

    if (mobileNumber) {
      filter.mobileNumber = { $regex: mobileNumber, $options: "i" };
    }

    if (businessname) {
      filter.buisnessname = {
        $regex: businessname,
        $options: "i",
      };
    }

    if (status) filter.status = status;

    if (source) filter.source = source;

    if (followupstartdate && followupenddate) {
      const startDate = new Date(followupstartdate); // Parse start date
      const endDate = new Date(followupenddate); // Parse end date
      endDate.setUTCHours(23, 59, 59, 999); // Set the end date to the end of the day

      // Add the followUpDate range filter
      filter.followUpDate = { $gte: startDate, $lte: endDate };
    } else if (followupstartdate) {
      const startDate = new Date(followupstartdate);
      filter.followUpDate = { $gte: startDate };
    } else if (followupenddate) {
      const endDate = new Date(followupenddate);
      endDate.setUTCHours(23, 59, 59, 999);
      filter.followUpDate = { $lte: endDate };
    }

    if (appointmentstartdate && appointmentenddate) {
      const startDate = new Date(appointmentstartdate);
      const endDate = new Date(appointmentenddate);
      endDate.setUTCHours(23, 59, 59, 999);

      filter.appointmentDate = { $gte: startDate, $lte: endDate };
    } else if (appointmentstartdate) {
      const startDate = new Date(appointmentstartdate);
      filter.appointmentDate = { $gte: startDate };
    } else if (appointmentenddate) {
      const endDate = new Date(appointmentenddate);
      endDate.setUTCHours(23, 59, 59, 999);
      filter.appointmentDate = { $lte: endDate };
    }

    if (createdstartdate && createdenddate) {
      const startDate = new Date(createdstartdate);
      const endDate = new Date(createdenddate);
      endDate.setUTCHours(23, 59, 59, 999);

      filter.createdAt = { $gte: startDate, $lte: endDate };
    } else if (createdstartdate) {
      const startDate = new Date(createdstartdate);
      filter.createdAt = { $gte: startDate };
    } else if (createdenddate) {
      const endDate = new Date(createdenddate);
      endDate.setUTCHours(23, 59, 59, 999);
      filter.createdAt = { $lte: endDate };
    }

    const applyCategoryCityFilter = (categories = [], cities = []) => {
      const categoryFilter =
        category || categories.length
          ? { category: { $in: category ? [category] : categories } }
          : null;
      const cityFilter =
        city || cities.length
          ? { city: { $in: city ? [city] : cities } }
          : null;

      const andConditions = [];
      if (categoryFilter) andConditions.push(categoryFilter);
      if (cityFilter) andConditions.push(cityFilter);

      if (andConditions.length > 0) {
        if (!filter.$and) filter.$and = [];
        filter.$and.push(...andConditions);
      }
    };

    applyCategoryCityFilter([], []);

    // Telecaller-specific filters
    if (telecallerId) {
      const telecaller = await Telecaller.findOne({ telecallerId });

      if (!telecaller) {
        return res.status(404).json({ message: "Telecaller not found" });
      }

      const assignedCategories = telecaller.assignCategories.map((c) =>
        c.category.trim()
      );
      const assignedCities = telecaller.assignCities.map((c) => c.city.trim());

      const orConditions = [];

      orConditions.push({ telecallerId });

      if (assignedCategories.length > 0) {
        orConditions.push({ category: { $in: assignedCategories } });
      }

      if (assignedCities.length > 0) {
        orConditions.push({ city: { $in: assignedCities } });
      }

      if (!filter.$or) filter.$or = [];
      filter.$or.push(...orConditions);
    }

    // Digital Marketer-specific filters
    if (digitalMarketerId) {
      const digitalMarketer = await DigitalMarketer.findOne({
        digitalMarketerId,
      });

      if (!digitalMarketer) {
        return res.status(404).json({ message: "Digital Marketer not found" });
      }

      const assignedCategories = digitalMarketer.assignCategories.map(
        (c) => c.category
      );
      const assignedCities = digitalMarketer.assignCities.map((c) => c.city);

      applyCategoryCityFilter(assignedCategories, assignedCities);
      // filter.digitalMarketerId = digitalMarketerId;
    }

    // BDE-specific filters
    if (bdeId) {
      const bde = await BDE.findOne({ bdeId });

      if (!bde) {
        return res.status(404).json({ message: "BDE not found" });
      }

      const bdeAssignedCategories = bde.assignCategories.map((c) =>
        c.category.trim()
      );
      const bdeAssignedCities = bde.assignCities.map((c) => c.city.trim());

      const orConditions = [];

      // Include businesses with the matching BDE ID
      orConditions.push({ bdeId });

      if (byTagAppointment === "true") {
        if (bdeAssignedCategories.length > 0) {
          orConditions.push({
            $or: [
              { tagAppointment: bdeId },
              { category: { $in: bdeAssignedCategories } },
            ],
          });
        } else {
          orConditions.push({ tagAppointment: bdeId });
        }
      } else {
        // Include assigned categories and cities
        if (bdeAssignedCategories.length > 0) {
          orConditions.push({ category: { $in: bdeAssignedCategories } });
        }

        if (bdeAssignedCities.length > 0) {
          orConditions.push({ city: { $in: bdeAssignedCities } });
        }
      }

      // Apply the OR condition to the filter
      if (!filter.$or) filter.$or = [];
      filter.$or.push(...orConditions);
    }

    let sort = {};
    sort = { tagAppointment: -1 };
    if (appointmentDate === "true") {
      sort.appointmentDate = -1;
    } else {
      sort.createdAt = -1;
    }

    // Pagination: Apply limit and skip

    const pageNumber = Math.max(1, parseInt(page));
    const skip = (pageNumber - 1) * parseInt(limit);

    // Fetch businesses with pagination
    const businesses = await business
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Fetch total count of businesses for pagination
    const totalCount = await business.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limit);

    const FollowupCount = await business.countDocuments({
      ...filter,
      status: "Followup",
    });
    const visitCount = await business.countDocuments({
      ...filter,
      status: "Appointment Generated",
    });
    const dealCloseCount = await business.countDocuments({
      ...filter,
      status: "Deal Closed",
    });

    // Send response with paginated data and pagination info
    res.status(200).json({
      businesses,
      totalPages,
      currentPage: parseInt(page),
      totalCount,
      statuscount: {
        FollowupCount,
        visitCount,
        dealCloseCount,
      },
    });
  } catch (error) {
    console.error("Error fetching businesses:", error);
    res.status(500).json({ message: "Error fetching businesses", error });
  }
};

exports.getBusinessSearch = async (req, res) => {
  try {
    const { search } = req.query;

    let filter = {};

    if (search) {
      filter.$or = [
        { buisnessname: { $regex: search, $options: "i" } },
        { mobileNumber: { $regex: search, $options: "i" } },
      ];
    }

    const businesses = await business.find(filter).limit(10);

    res.status(200).json(businesses);
  } catch (error) {
    console.error("Error fetching businesses:", error);
    res.status(500).json({ message: "Error fetching businesses", error });
  }
};

exports.getBusinessformarketing = async (req, res) => {
  try {
    const { category, city, status } = req.query;

    // Build the filter object for selected category, city, and status
    let filter = {};

    if (category) filter.category = category;
    if (city) filter.city = city;
    if (status) filter.status = status;

    // Aggregation pipeline to fetch filtered businesses (with mobile numbers)
    let aggregationPipeline = [
      {
        $match: filter, // Apply the filters (if any)
      },
      {
        $group: {
          _id: null,
          categories: { $addToSet: "$category" },
          cities: { $addToSet: "$city" },
          statuses: { $addToSet: "$status" },
          mobileNumbers: { $push: "$mobileNumber" }, // Add mobile numbers to the result
        },
      },
    ];

    // If no filter is applied, just return all unique categories, cities, and statuses without any mobile numbers
    if (!category && !city && !status) {
      aggregationPipeline = [
        {
          $group: {
            _id: null,
            categories: { $addToSet: "$category" },
            cities: { $addToSet: "$city" },
            statuses: { $addToSet: "$status" },
          },
        },
      ];
    }

    // Execute aggregation
    const result = await business.aggregate(aggregationPipeline);

    if (result.length > 0) {
      const { categories, cities, statuses, mobileNumbers } = result[0];
      res.status(200).json({
        categories,
        cities,
        statuses,
        mobileNumbers: mobileNumbers || [], // Mobile numbers if filters are applied
      });
    } else {
      res.status(200).json({
        categories: [],
        cities: [],
        statuses: [],
        mobileNumbers: [], // Return empty if no records match
      });
    }
  } catch (error) {
    console.error("Error fetching filtered businesses:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getBusinessFilter = async (req, res) => {
  try {
    const { telecallerId, bdeId, digitalMarketerId } = req.query;

    let cities = [];
    let businessCategories = [];
    let status = [];

    if (telecallerId || bdeId || digitalMarketerId) {
      let assignedCategories = [];
      let addedCategories = [];
      let tagAppointmentCategories = [];

      // Determine assigned categories based on the user role
      if (telecallerId) {
        const telecaller = await Telecaller.findOne({ telecallerId });
        if (!telecaller) {
          return res.status(404).json({ message: "Telecaller not found" });
        }
        assignedCategories = telecaller.assignCategories.map((c) =>
          c.category.trim()
        );
        addedCategories = await business.distinct("category", {
          telecallerId,
        });
      } else if (bdeId) {
        const bde = await BDE.findOne({ bdeId });
        if (!bde) {
          return res.status(404).json({ message: "BDE not found" });
        }
        assignedCategories = bde.assignCategories.map((c) => c.category.trim());
        tagAppointmentCategories = await business.distinct("category", {
          tagAppointment: bdeId,
        });
        addedCategories = await business.distinct("category", { bdeId });
      } else if (digitalMarketerId) {
        const digitalMarketer = await DigitalMarketer.findOne({
          digitalMarketerId,
        });
        if (!digitalMarketer) {
          return res
            .status(404)
            .json({ message: "Digital Marketer not found" });
        }
        assignedCategories = digitalMarketer.assignCategories.map((c) =>
          c.category.trim()
        );
        addedCategories = await business.distinct("category", {
          digitalMarketerId,
        });
      }

      const allCategories = Array.from(
        new Set([
          ...assignedCategories,
          ...addedCategories,
          ...tagAppointmentCategories,
        ])
      );

      if (allCategories.length > 0) {
        // Fetch distinct filters based on combined categories
        businessCategories = await business.distinct("category", {
          category: { $in: allCategories },
        });

        cities = await business.distinct("city", {
          category: { $in: allCategories },
        });

        status = await business.distinct("status", {
          category: { $in: allCategories },
        });
      }
    } else {
      // Fetch all distinct filters when no specific role is provided
      cities = await business.distinct("city");
      businessCategories = await business.distinct("category");
      status = await business.distinct("status");
    }

    cities.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    businessCategories.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    status.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    // Respond with unique filter values
    res.status(200).json({ cities, businessCategories, status });
  } catch (error) {
    console.error("Error fetching Business:", error.message);
    res.status(500).json({ message: "Error fetching Business", error });
  }
};

// Get a business by businessId
exports.getBusinessById = async (req, res) => {
  try {
    const { businessId } = req.params;

    // Find lead by leadId
    const businesses = await business.findOne({ businessId });
    if (!businesses) {
      return res.status(404).json({ message: "Business not found" });
    }

    res.status(200).json(businesses);
  } catch (error) {
    console.error("Error fetching Business:", error.message);
    res.status(500).json({ message: "Error fetching Business", error });
  }
};

// Update a lead by leadId
exports.updateBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    const {
      buisnessname,
      contactpersonName,
      mobileNumber,
      city,
      category,
      status,
      followUpDate,
      source,
      remarks,
    } = req.body;

    // Find the business to update by businessId
    const businessUpdate = await business.findOne({ businessId });
    if (!businessUpdate) {
      return res.status(404).json({ message: "Business not found" });
    }

    // Update business details
    businessUpdate.buisnessname = buisnessname || businessUpdate.buisnessname;
    businessUpdate.contactpersonName =
      contactpersonName !== undefined
        ? contactpersonName
        : businessUpdate.contactpersonName;
    businessUpdate.mobileNumber = mobileNumber || businessUpdate.mobileNumber;
    businessUpdate.city = city || businessUpdate.city;
    businessUpdate.category = category || businessUpdate.category;
    businessUpdate.status = status || businessUpdate.status;
    businessUpdate.source = source || businessUpdate.source;
    businessUpdate.remarks = remarks || businessUpdate.remarks;
    businessUpdate.followUpDate = followUpDate || businessUpdate.followUpDate;

    // Save the updated business
    await businessUpdate.save();
    res
      .status(200)
      .json({ message: "Business updated successfully", businessUpdate });
  } catch (error) {
    console.error("Error updating Business:", error.message);
    res.status(500).json({ message: "Error updating business", error });
  }
};

// Delete a lead by leadId
exports.deleteBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;

    // Find the lead to delete
    const businessDelete = await business.findOne({ businessId });
    if (!businessDelete) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Delete the lead from the leads collection
    await business.findOneAndDelete({ businessId });

    res.status(200).json({ message: "Lead deleted successfully" });
  } catch (error) {
    console.error("Error deleting lead:", error.message);
    res.status(500).json({ message: "Error deleting lead", error });
  }
};

exports.tagAppointment = async (req, res) => {
  const { businessId } = req.params;
  const { bdeId, appointmentDate } = req.body;

  try {
    // Update the business with the selected bdeId and appointmentDate
    const updatedBusiness = await business.findOneAndUpdate(
      { businessId: businessId },
      {
        bdeId: bdeId,
        tagAppointment: bdeId,
        appointmentDate: appointmentDate,
      },
      { new: true }
    );

    if (!updatedBusiness) {
      return res.status(404).json({ message: "Business not found" });
    }

    res.json(updatedBusiness);
  } catch (error) {
    console.error("Error tagging appointment:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// excel import

exports.excelImport = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      console.log("No file uploaded");
      return res.status(400).send({ message: "No file uploaded" });
    }

    const file = req.files.file;
    const uploadDir = path.join(__dirname, "../uploads");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, file.name);
    await file.mv(filePath);

    const fileExtension = path.extname(file.name).toLowerCase();
    if (fileExtension !== ".csv") {
      console.log("Unsupported file type");
      return res.status(400).send({ message: "Only CSV files are supported" });
    }

    const validBusinesses = [];
    const duplicateNumbersInFile = [];
    const duplicateNumbersInDB = [];
    const seenNumbers = new Set();

    const processRow = async (item) => {
      const businessId = await generatebusinessId();
      const businessData = {
        businessId,
        buisnessname: item["buisnessname"]?.trim(),
        contactpersonName: item["contactpersonName"]?.trim(),
        mobileNumber: item["mobileNumber"],
        city: item["city"]?.trim(),
        category: item["category"]?.trim(),
        status: item["status"]?.trim(),
        followUpDate: item["followUpDate"]?.trim(),
        source: item["source"]?.trim(),
        remarks: item["remarks"]?.trim(),
      };

      if (
        !businessData.buisnessname ||
        !businessData.mobileNumber ||
        !businessData.city ||
        !businessData.category ||
        !businessData.status ||
        !businessData.source
      ) {
        return;
      }

      if (seenNumbers.has(businessData.mobileNumber)) {
        duplicateNumbersInFile.push(businessData.mobileNumber);

        return;
      }
      seenNumbers.add(businessData.mobileNumber);

      const existingBusiness = await business.findOne({
        mobileNumber: businessData.mobileNumber,
      });
      if (existingBusiness) {
        duplicateNumbersInDB.push(businessData.mobileNumber);

        return;
      }

      validBusinesses.push(businessData);
    };

    const stream = fs.createReadStream(filePath);
    const csvStream = fastcsv.parse({ headers: true, trim: true });

    // Create an array of promises that represent each row being processed
    const rowProcessingPromises = [];

    csvStream.on("data", (row) => {
      // Add the row processing promise to the array
      const rowPromise = processRow(row);
      rowProcessingPromises.push(rowPromise);
    });

    csvStream.on("end", async () => {
      await Promise.all(rowProcessingPromises);

      if (validBusinesses.length > 0) {
        try {
          const result = await business.insertMany(validBusinesses);
        } catch (insertError) {
          console.error("Error during insertion:", insertError);
          return res.status(500).send({
            message: "Error saving data to the database",
            error: insertError,
          });
        }
      } else {
        console.log("No valid businesses to insert.");
      }

      fs.unlinkSync(filePath);

      return res.status(200).send({
        message: "File uploaded and data processed successfully",
        duplicatesInFile: duplicateNumbersInFile,
        duplicatesInDB: duplicateNumbersInDB,
      });
    });

    csvStream.on("error", (error) => {
      console.error("Error during CSV file processing:", error);
      return res.status(500).send({ message: "Error processing file", error });
    });

    stream.pipe(csvStream);
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).send({ message: "Error processing file", error });
  }
};

// exports.excelImport = async (req, res) => {
//   try {
//     // Check if a file is uploaded
//     if (!req.files || !req.files.file) {
//       console.log("No file uploaded");
//       return res.status(400).send({ message: "No file uploaded" });
//     }

//     const file = req.files.file;
//     const fileExtension = path.extname(file.name).toLowerCase();

//     // Only allow CSV files
//     if (fileExtension !== ".csv") {
//       console.log("Unsupported file type");
//       return res.status(400).send({ message: "Only CSV files are supported" });
//     }

//     // Fetch all existing mobile numbers from the database
//     const existingBusinesses = await business.find({}, { mobileNumber: 1 });
//     const existingNumbersSet = new Set(
//       existingBusinesses.map((b) => b.mobileNumber)
//     );

//     const seenNumbers = new Set(); // Track duplicates within the uploaded CSV
//     const validBusinesses = [];
//     const duplicateNumbersInFile = [];
//     const duplicateNumbersInDB = [];
//     const BATCH_SIZE = 1000; // Define batch size for bulk insert

//     // Function to process each row
//     const processRow = async (item) => {
//       return new Promise((resolve) => {
//         setImmediate(async () => {
//           try {
//             const mobileNumber = item["mobileNumber"]?.trim();
//             if (!mobileNumber) return resolve(); // Skip empty rows

//             const businessData = {
//               businessId: await generatebusinessId(),
//               buisnessname: item["buisnessname"]?.trim(),
//               contactpersonName: item["contactpersonName"]?.trim(),
//               mobileNumber,
//               city: item["city"]?.trim(),
//               category: item["category"]?.trim(),
//               status: item["status"]?.trim(),
//               followUpDate: item["followUpDate"]?.trim(),
//               source: item["source"]?.trim(),
//               remarks: item["remarks"]?.trim(),
//             };

//             if (!businessData.buisnessname || !businessData.mobileNumber)
//               return resolve(); // Required validation

//             if (seenNumbers.has(businessData.mobileNumber)) {
//               duplicateNumbersInFile.push(businessData.mobileNumber);
//               return resolve();
//             }
//             seenNumbers.add(businessData.mobileNumber);

//             if (existingNumbersSet.has(businessData.mobileNumber)) {
//               duplicateNumbersInDB.push(businessData.mobileNumber);
//               return resolve();
//             }

//             validBusinesses.push(businessData);

//             if (validBusinesses.length >= BATCH_SIZE) {
//               await business.insertMany(validBusinesses, { ordered: false });
//               validBusinesses.length = 0; // Clear batch
//             }

//             resolve();
//           } catch (rowError) {
//             console.error("Error processing row:", rowError);
//             resolve(); // Continue even on error
//           }
//         });
//       });
//     };

//     // Use the file from the temporary location (because useTempFiles is enabled)
//     const filePath = file.tempFilePath;

//     // Create a readable stream from the temporary file path
//     const fileStream = fs.createReadStream(filePath);

//     // Stream and process the CSV file in chunks
//     const csvStream = fastcsv.parse({ headers: true, trim: true });

//     csvStream.on("data", async (row) => {
//       csvStream.pause(); // Pause the stream to process each batch
//       try {
//         await processRow(row);
//       } catch (dataError) {
//         console.error("Error during CSV row processing:", dataError);
//       }
//       csvStream.resume(); // Resume the stream once the row is processed
//     });

//     csvStream.on("end", async () => {
//       try {
//         if (validBusinesses.length > 0) {
//           await business.insertMany(validBusinesses, { ordered: false });
//         }
//       } catch (endError) {
//         console.error("Error inserting remaining businesses:", endError);
//       } finally {
//         fs.unlink(filePath, (err) => {
//           if (err) console.error("Error deleting temp file:", err);
//           else console.log("Temporary file deleted successfully.");
//         });
//       }

//       return res.status(200).send({
//         message: "File uploaded and data processed successfully",
//         duplicatesInFile: duplicateNumbersInFile,
//         duplicatesInDB: duplicateNumbersInDB,
//       });
//     });

//     csvStream.on("error", (error) => {
//       console.error("Error during CSV file processing:", error);
//       return res.status(500).send({ message: "Error processing file", error });
//     });

//     // Pipe the file stream to the CSV parser
//     fileStream.pipe(csvStream);
//   } catch (error) {
//     console.error("Error processing file:", error);
//     res.status(500).send({ message: "Error processing file", error });
//   }
// };
// category wise delete

exports.deleteBusinessesByCategory = async (req, res) => {
  try {
    const { category } = req.params; // Correct parameter name

    if (!category) {
      return res.status(400).json({ error: "Category name is required" });
    }

    // Delete all businesses with the given category name
    const deleteResult = await business.deleteMany({ category });

    if (deleteResult.deletedCount === 0) {
      return res
        .status(404)
        .json({ message: "No businesses found with this category name" });
    }

    res.status(200).json({
      message: `${deleteResult.deletedCount} businesses deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting businesses by category:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};
