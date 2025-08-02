const business = require("../models/businessModel");
const path = require("path");
const fs = require("fs");
const fastcsv = require("fast-csv");

const mongoose = require("mongoose");
const User = require("../models/user");
const generateCustomId = require("../middleware/generateCustomId");
const cityModel = require("../models/cityModel");
const categoryModel = require("../models/categoryModel");
const leadsourceModel = require("../models/leadsourceModel");

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
      appoint_to,
      lead_by,
      remarks,
      created_by,
    } = req.body;

    const businessId = await generateCustomId(
      business,
      "businessId",
      "businessId"
    );

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
      appoint_to,
      lead_by,
      created_by,
    });

    await newBusiness.save();

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

exports.getBusiness = async (req, res) => {
  try {
    const {
      search,
      mobileNumber,
      city,
      category,
      status,
      source,
      assignedTo,
      leadBy,
      createdBy,
      followupstartdate,
      followupenddate,
      appointmentstartdate,
      appointmentenddate,
      createdstartdate,
      createdenddate,
      businessname,
      sortBy,
      sortOrder = "desc",
    } = req.query;

    const limit =
      parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 20;
    const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
    const skip = (page - 1) * limit;

    // The main filter object to be built
    const findFilter = {};

    // --- Helper to Parse and Validate Multiple Object IDs ---
    const parseAndValidateObjectIds = (paramValue) => {
      if (!paramValue) return null;
      const ids = (
        Array.isArray(paramValue) ? paramValue : paramValue.split(",")
      )
        .map((id) => id.trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      return ids.length > 0 ? { $in: ids } : null;
    };

    // --- User Resolution Helper (for assignedTo, leadBy, createdBy) ---
    const resolvedUserIdsCache = {};
    const resolveUser = async (paramValue) => {
      if (!paramValue) return null;
      if (resolvedUserIdsCache[paramValue])
        return resolvedUserIdsCache[paramValue];
      let user = null;
      if (mongoose.Types.ObjectId.isValid(paramValue)) {
        user = await User.findById(paramValue);
      }
      if (!user) {
        user = await User.findOne({ userId: paramValue });
      }
      if (user) {
        resolvedUserIdsCache[paramValue] = user;
        return user;
      }
      return null;
    };

    // --- Resolve user IDs upfront to use them in the filter ---
    const [assignedToUser, leadByUser, createdByUser] = await Promise.all([
      assignedTo ? resolveUser(assignedTo) : Promise.resolve(null),
      leadBy ? resolveUser(leadBy) : Promise.resolve(null),
      createdBy ? resolveUser(createdBy) : Promise.resolve(null),
    ]);

    // --- Build the main filter object ---

    if (search) {
      const searchRegex = new RegExp(search, "i");
      findFilter.$or = [
        { buisnessname: searchRegex },
        { contactpersonName: searchRegex },
        { mobileNumber: searchRegex },
        { remarks: searchRegex },
      ];
    }

    if (mobileNumber) {
      findFilter.mobileNumber = { $regex: mobileNumber, $options: "i" };
    }
    if (businessname) {
      findFilter.buisnessname = { $regex: businessname, $options: "i" };
    }

    // Explicit ID-based filters
    const cityIds = parseAndValidateObjectIds(city);
    if (cityIds) findFilter.city = cityIds;

    const categoryIds = parseAndValidateObjectIds(category);
    if (categoryIds) findFilter.category = categoryIds;

    const sourceIds = parseAndValidateObjectIds(source);
    if (sourceIds) findFilter.source = sourceIds;

    // User-based filters
    if (assignedToUser) findFilter.appoint_to = assignedToUser._id;
    if (leadByUser) findFilter.lead_by = leadByUser._id;
    if (createdByUser) findFilter.created_by = createdByUser._id;

    // Status filter with special handling for 'visit_result.reason'
    if (status) {
      const statusesToIncludeReason = [
        "Followup",
        "Not Interested",
        "Deal Closed",
        "Visited",
      ];
      if (statusesToIncludeReason.includes(status)) {
        findFilter.$or = findFilter.$or || []; // Ensure $or array exists
        findFilter.$or.push(
          { status: status },
          { "visit_result.reason": status }
        );
      } else {
        findFilter.status = status;
      }
    }

    // Date Range filters
    const applyDateRangeFilter = (field, startDate, endDate) => {
      if (startDate || endDate) {
        const dateRange = {};
        if (startDate) dateRange.$gte = new Date(startDate);
        if (endDate) {
          const endOfDay = new Date(endDate);
          endOfDay.setUTCHours(23, 59, 59, 999);
          dateRange.$lte = endOfDay;
        }
        return { [field]: dateRange };
      }
      return null;
    };

    const dateFilters = [
      applyDateRangeFilter("followUpDate", followupstartdate, followupenddate),
      applyDateRangeFilter(
        "appointmentDate",
        appointmentstartdate,
        appointmentenddate
      ),
      applyDateRangeFilter("createdAt", createdstartdate, createdenddate),
    ].filter(Boolean);

    if (dateFilters.length > 0) {
      findFilter.$and = dateFilters;
    }

    // --- Dynamic Sorting ---
    let sort = { createdAt: -1 };
    if (sortBy) {
      const order = sortOrder.toLowerCase() === "asc" ? 1 : -1;
      const allowedSortFields = [
        "buisnessname",
        "mobileNumber",
        "createdAt",
        "appointmentDate",
        "followUpDate",
        "status",
      ];
      if (allowedSortFields.includes(sortBy)) {
        sort = { [sortBy]: order };
      }
    }

    // --- Fetch Businesses and Counts ---
    const [businesses, filteredBusinessesCount] = await Promise.all([
      business
        .find(findFilter)
        .populate("city", "cityname")
        .populate("category", "categoryname")
        .populate("source", "sourcename")
        .populate("lead_by", "name userId")
        .populate("appoint_to", "name userId")
        .populate("created_by", "name userId")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      business.countDocuments(findFilter), // Use the same filter for counting
    ]);

    const grandTotalBusinesses = await business.countDocuments({});
    const totalPages = Math.ceil(filteredBusinessesCount / limit);

    // --- Status Counts (based on the common 'findFilter') ---
    const [followupCount, appointmentCount, dealCloseCount, visitCount] =
      await Promise.all([
        business.countDocuments({
          ...findFilter,
          $or: [{ status: "Followup" }, { "visit_result.reason": "Followup" }],
        }),
        business.countDocuments({
          ...findFilter,
          status: "Appointment Generated",
        }),
        business.countDocuments({
          ...findFilter,
          $or: [
            { status: "Deal Closed" },
            { "visit_result.reason": "Deal Closed" },
          ],
        }),
        business.countDocuments({
          ...findFilter,
          status: "Visited",
        }),
      ]);

    res.status(200).json({
      success: true,
      businesses,
      totalPages,
      currentPage: page,
      totalCount: filteredBusinessesCount,
      statusCount: {
        grandTotalBusinesses,
        FollowupCount: followupCount,
        appointmentCount,
        visitCount,
        dealCloseCount,
      },
    });
  } catch (error) {
    console.error("Error fetching businesses:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching businesses",
      error: error.message,
    });
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
    const businesses = await business
      .findOne({
        $or: [
          { businessId },
          {
            _id: mongoose.Types.ObjectId.isValid(businessId)
              ? businessId
              : null,
          },
        ],
      })
      .populate("category")
      .populate("city")
      .populate("source")
      .populate("lead_by")
      .populate("appoint_to");
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
      visit_result,
      appointmentDate,
      appoint_to,
      lead_by,
    } = req.body;

    // Find the business to update by businessId
    const businessUpdate = await business.findOne({
      $or: [
        {
          _id: mongoose.Types.ObjectId.isValid(businessId) ? businessId : null,
        },
        { businessId },
      ],
    });

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
    businessUpdate.visit_result = visit_result || businessUpdate.visit_result;
    businessUpdate.appointmentDate =
      appointmentDate || businessUpdate.appointmentDate;
    businessUpdate.appoint_to = appoint_to || businessUpdate.appoint_to;
    businessUpdate.lead_by = lead_by || businessUpdate.lead_by;

    // Save the updated business
    await businessUpdate.save();
    res
      .status(200)
      .json({ message: "Business updated successfully", businessUpdate });
  } catch (error) {
    console.error("Error updating Business:", error);
    res.status(500).json({ message: "Error updating business", error });
  }
};

// Delete a lead by leadId
exports.deleteBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;

    // Find the lead to delete
    const businessDelete = await business.findOne({
      $or: [
        { businessId },
        {
          _id: mongoose.Types.ObjectId.isValid(businessId) ? businessId : null,
        },
      ],
    });
    if (!businessDelete) {
      return res.status(404).json({ message: "Lead not found" });
    }

    await business.findByIdAndDelete(businessDelete._id);

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

// Define valid status enum values from your schema for validation
const VALID_BUSINESS_STATUSES = [
  "Fresh Data",
  "Appointment Generated",
  "Followup",
  "Not Interested",
  "Invalid Data",
  "Not Responding",
  "Deal Closed",
  "Visited",
];

exports.excelImport = async (req, res) => {
  let filePath = ""; // Declare filePath outside try for finally block access
  try {
    // 1. File Upload Validation
    if (!req.files || !req.files.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded." });
    }

    const file = req.files.file;
    const uploadDir = path.join(__dirname, "../uploads");
    filePath = path.join(uploadDir, file.name); // Assign to outer scope filePath
    const fileExtension = path.extname(file.name).toLowerCase();

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Move the uploaded file to the designated path
    await file.mv(filePath);

    // Validate file type
    if (fileExtension !== ".csv") {
      // Clean up the uploaded file if it's not a CSV
      fs.unlinkSync(filePath); // Synchronous unlink here as we are returning immediately
      return res
        .status(400)
        .json({ success: false, message: "Only CSV files are supported." });
    }

    const validBusinessesToInsert = [];
    const invalidRows = []; // To store rows that failed validation
    const duplicateNumbersInFile = [];
    const duplicateNumbersInDB = [];
    const seenNumbersInFile = new Set(); // Tracks mobile numbers within the current CSV file

    // 2. Process CSV File Row by Row
    const stream = fs.createReadStream(filePath);
    const csvStream = fastcsv.parse({ headers: true, trim: true });

    const rowProcessingPromises = []; // Array to hold promises for each row's async processing

    csvStream.on("data", (row) => {
      // Create a promise for processing each row and add it to the array
      const rowPromise = (async () => {
        const rowErrors = []; // Errors specific to this row
        const originalRow = { ...row }; // Keep a copy of the original row for error reporting

        // Trim all string values in the row to handle whitespace issues
        for (const key in row) {
          if (typeof row[key] === "string") {
            row[key] = row[key].trim();
          }
        }

        // --- Basic Required Field Validation ---
        // Check for presence of required fields
        const requiredFields = [
          "buisnessname",
          "mobileNumber",
          "city",
          "category",
          "status",
          "source",
        ];
        for (const field of requiredFields) {
          if (!row[field]) {
            rowErrors.push(`Missing required field: '${field}'`);
          }
        }

        if (rowErrors.length > 0) {
          invalidRows.push({ row: originalRow, errors: rowErrors.join(", ") });
          return; // Skip this row if basic required fields are missing
        }

        // --- Duplicate Mobile Number in File Check ---
        if (seenNumbersInFile.has(row.mobileNumber)) {
          duplicateNumbersInFile.push(row.mobileNumber);
          invalidRows.push({
            row: originalRow,
            errors: "Duplicate mobile number found within the uploaded file.",
          });
          return;
        }
        seenNumbersInFile.add(row.mobileNumber);

        // --- Database Lookups for Referenced IDs and Enums ---
        let cityId, categoryId, sourceId;
        try {
          const [cityDoc, categoryDoc, sourceDoc] = await Promise.all([
            CityName.findOne({ cityname: row.city }), // Assuming field is 'cityname' in CityName model
            Category.findOne({ categoryname: row.category }), // Assuming field is 'categoryname' in Category model
            LeadSource.findOne({ sourcename: row.source }), // Assuming field is 'sourcename' in LeadSource model
          ]);

          if (!cityDoc)
            rowErrors.push(`City '${row.city}' not found in database.`);
          else cityId = cityDoc._id;

          if (!categoryDoc)
            rowErrors.push(`Category '${row.category}' not found in database.`);
          else categoryId = categoryDoc._id;

          if (!sourceDoc)
            rowErrors.push(`Source '${row.source}' not found in database.`);
          else sourceId = sourceDoc._id;
        } catch (dbError) {
          console.error(
            `Database lookup error for row: ${JSON.stringify(originalRow)}`,
            dbError
          );
          rowErrors.push(
            `Database lookup error for city/category/source: ${dbError.message}`
          );
        }

        // --- Validate Status Enum & Default to "Fresh Data" if Mismatch ---
        let finalStatus = row.status;
        if (!VALID_BUSINESS_STATUSES.includes(row.status)) {
          console.warn(
            `Invalid 'status' value '${row.status}' for row. Defaulting to 'Fresh Data'.`
          );
          finalStatus = "Fresh Data"; // Default to "Fresh Data"
          // No error pushed to rowErrors for this case, as it's handled by defaulting
        }

        // If any errors occurred during DB lookups, push to invalidRows and skip
        if (rowErrors.length > 0) {
          invalidRows.push({ row: originalRow, errors: rowErrors.join(", ") });
          return;
        }

        // --- Check for Duplicate Mobile Number in Database ---
        const existingBusiness = await Business.findOne({
          mobileNumber: row.mobileNumber,
        });
        if (existingBusiness) {
          duplicateNumbersInDB.push(row.mobileNumber);
          invalidRows.push({
            row: originalRow,
            errors: "Mobile number already exists in the database.",
          });
          return;
        }

        // --- Prepare Business Data for Insertion ---
        // Use your custom ID generator with a prefix, e.g., "B" for Business
        const businessId = await generateCustomId("B");

        const newBusinessData = {
          businessId,
          buisnessname: row.buisnessname,
          contactpersonName: row.contactpersonName || null,
          mobileNumber: row.mobileNumber,
          city: cityId,
          category: categoryId,
          status: finalStatus, // Use the potentially defaulted status
          source: sourceId,
          remarks: row.remarks || null,
          followUpDate: null, // Default to null
        };

        if (row.followUpDate) {
          const parsedDate = new Date(row.followUpDate);
          if (!isNaN(parsedDate.getTime())) {
            newBusinessData.followUpDate = parsedDate;
          } else {
            rowErrors.push(
              "Invalid 'followUpDate' format. Please use a valid date string (e.g., YYYY-MM-DD)."
            );
          }
        }

        if (rowErrors.length > 0) {
          invalidRows.push({ row: originalRow, errors: rowErrors.join(", ") });
          return;
        }

        validBusinessesToInsert.push(newBusinessData);
      })(); // Immediately invoke the async IIFE for each row
      rowProcessingPromises.push(rowPromise);
    });

    // 3. Handle End of CSV Stream
    csvStream.on("end", async () => {
      // Wait for all row processing promises to complete
      await Promise.all(rowProcessingPromises);

      let insertedCount = 0;
      let insertionError = null;

      if (validBusinessesToInsert.length > 0) {
        try {
          // ordered: false allows other documents to be inserted even if one fails
          const result = await Business.insertMany(validBusinessesToInsert, {
            ordered: false,
          });
          insertedCount = result.length;
        } catch (err) {
          console.error("Error during bulk insertion:", err);
          insertionError = err;
          // Note: If insertMany fails due to a unique index (e.g., mobileNumber),
          // it will throw an error even with ordered: false. The valid ones before
          // the error will be inserted. You might need more granular error parsing
          // from `err.writeErrors` if you want to report which specific documents failed.
        }
      } else {
        console.log("No valid businesses to insert after processing file.");
      }

      // 4. Clean up the uploaded file (async)
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting uploaded file:", err);
      });

      // 5. Send Final Response
      if (insertionError) {
        return res.status(500).json({
          success: false,
          message:
            "File processed, but errors occurred during database insertion.",
          insertedCount: insertedCount,
          duplicatesInFile: duplicateNumbersInFile,
          duplicatesInDB: duplicateNumbersInDB,
          invalidRows: invalidRows,
          insertionErrorMessage: insertionError.message,
        });
      } else {
        return res.status(200).json({
          success: true,
          message: "File uploaded and data processed successfully.",
          insertedCount: insertedCount,
          duplicatesInFile: duplicateNumbersInFile,
          duplicatesInDB: duplicateNumbersInDB,
          invalidRows: invalidRows, // Report rows that failed validation/duplication checks
        });
      }
    });

    // 4. Handle CSV Stream Errors
    csvStream.on("error", (error) => {
      console.error("Error during CSV file streaming:", error);
      // Ensure file is unlinked on stream error too (async)
      fs.unlink(filePath, (err) => {
        if (err)
          console.error("Error deleting uploaded file on stream error:", err);
      });
      return res.status(500).json({
        success: false,
        message: "Error processing CSV file stream.",
        error: error.message,
      });
    });

    // Pipe the file stream to the CSV parser
    stream.pipe(csvStream);
  } catch (error) {
    console.error("Unhandled error in excelImport:", error);
    // Ensure file is unlinked if an error occurs before stream setup
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err)
          console.error("Error deleting uploaded file in catch block:", err);
      });
    }
    res.status(500).json({
      success: false,
      message:
        "Internal server error during file upload or initial processing.",
      error: error.message,
    });
  }
};

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
