const business = require("../models/businessModel");
const Telecaller = require("../models/telecallerModel");
const BDE = require("../models/bdeModel");
const DigitalMarketer = require("../models/digitalMarketerModel");
const path = require("path");
const fs = require("fs");
const fastcsv = require("fast-csv");

const mongoose = require("mongoose");
const User = require("../models/user");

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

    const userId = req.user._id;
    const userType = req.userType;

    switch (userType) {
      case "bde":
        await BDE.findByIdAndUpdate(userId, {
          $push: { created_business: newBusiness._id },
        });
        break;
      case "telecaller":
        await Telecaller.findByIdAndUpdate(userId, {
          $push: { created_business: newBusiness._id },
        });
        break;
      case "digitalMarketer":
        await DigitalMarketer.findByIdAndUpdate(userId, {
          $push: { created_business: newBusiness._id },
        });
        break;
      default:
        await User.findByIdAndUpdate(userId, {
          $push: { created_business: newBusiness._id },
        });
        break;
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
      createdBy,
    } = req.query;

    const limit =
      parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 20;
    const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;

    let baseFilter = {};
    let filter = {}; // Main filter for fetching businesses (includes all filters)
    let totalCountFilterForCreatedAndOverallWithoutDates = {}; // This was your original totalCountFilter
    let createdCountFilter = {}; // Specific filter for created_business_count (without dates)

    // --- Common Filters (applied to baseFilter first) ---
    if (mobileNumber) {
      baseFilter.mobileNumber = { $regex: mobileNumber, $options: "i" };
    }
    if (businessname) {
      baseFilter.buisnessname = { $regex: businessname, $options: "i" };
    }
    if (status) {
      baseFilter.status = status;
    }
    if (source) {
      baseFilter.source = source;
    }

    // Clone baseFilter into the specific filters
    Object.assign(filter, baseFilter);
    Object.assign(totalCountFilterForCreatedAndOverallWithoutDates, baseFilter); // This will be used for created_business_count and a general total if needed
    Object.assign(createdCountFilter, baseFilter);

    // Helper function for category/city filters
    const applyCategoryCityFilter = (
      targetFilter,
      categories = [],
      cities = []
    ) => {
      const catConditions = [];
      if (category) catConditions.push(category);
      catConditions.push(...categories); // Add assigned categories

      const cityConditions = [];
      if (city) cityConditions.push(city);
      cityConditions.push(...cities); // Add assigned cities

      const andConditions = [];
      if (catConditions.length > 0) {
        andConditions.push({ category: { $in: catConditions } });
      }
      if (cityConditions.length > 0) {
        andConditions.push({ city: { $in: cityConditions } });
      }

      if (andConditions.length > 0) {
        if (!targetFilter.$and) targetFilter.$and = [];
        targetFilter.$and.push(...andConditions);
      }
    };

    // Apply general category/city filters from req.query to all relevant filters
    applyCategoryCityFilter(filter);
    applyCategoryCityFilter(totalCountFilterForCreatedAndOverallWithoutDates);
    applyCategoryCityFilter(createdCountFilter);

    // Initialize arrays for top-level AND conditions for all filters
    if (!filter.$and) filter.$and = [];
    if (!totalCountFilterForCreatedAndOverallWithoutDates.$and)
      totalCountFilterForCreatedAndOverallWithoutDates.$and = [];
    if (!createdCountFilter.$and) createdCountFilter.$and = [];

    // --- Date Filters (APPLIED ONLY TO 'filter' object) ---
    // These date filters are NOT applied to totalCountFilterForCreatedAndOverallWithoutDates or createdCountFilter
    if (followupstartdate && followupenddate) {
      const startDate = new Date(followupstartdate);
      const endDate = new Date(followupenddate);
      endDate.setUTCHours(23, 59, 59, 999);
      filter.followUpDate = { $gte: startDate, $lte: endDate };
      filter.$and.push({
        "visit_result.follow_up_date": { $gte: startDate, $lte: endDate },
      });
    } else if (followupstartdate) {
      const startDate = new Date(followupstartdate);
      filter.followUpDate = { $gte: startDate };
      filter.$and.push({ "visit_result.follow_up_date": { $gte: startDate } });
    } else if (followupenddate) {
      const endDate = new Date(followupenddate);
      endDate.setUTCHours(23, 59, 59, 999);
      filter.followUpDate = { $lte: endDate };
      filter.$and.push({ "visit_result.follow_up_date": { $lte: endDate } });
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

    let targetUserFound = false; // Flag to check if any specific user ID was used for created_business_count
    let createdBusinessIdsToCount = []; // Collect IDs for the created_business_count filter

    // --- Prioritized Created Business Count Logic (applies to createdCountFilter) ---

    // 1. createdBy (Highest Priority)
    if (createdBy) {
      targetUserFound = true;
      let creatorUser = null;
      const [bdeUser, telecallerUser, digitalMarketerUser, adminUser] =
        await Promise.all([
          BDE.findOne({
            $or: [
              {
                _id: mongoose.Types.ObjectId.isValid(createdBy)
                  ? createdBy
                  : undefined,
              },
              { bdeId: createdBy },
            ],
          }),
          Telecaller.findOne({
            $or: [
              {
                _id: mongoose.Types.ObjectId.isValid(createdBy)
                  ? createdBy
                  : undefined,
              },
              { telecallerId: createdBy },
            ],
          }),
          DigitalMarketer.findOne({
            $or: [
              {
                _id: mongoose.Types.ObjectId.isValid(createdBy)
                  ? createdBy
                  : undefined,
              },
              { digitalMarketerId: createdBy },
            ],
          }),
          User.findById(
            mongoose.Types.ObjectId.isValid(createdBy) ? createdBy : undefined
          ),
        ]);

      if (bdeUser) {
        creatorUser = bdeUser;
      } else if (telecallerUser) {
        creatorUser = telecallerUser;
      } else if (digitalMarketerUser) {
        creatorUser = digitalMarketerUser;
      } else if (adminUser) {
        creatorUser = adminUser;
      }

      if (!creatorUser) {
        createdBusinessIdsToCount = [];
        filter.$and.push({ _id: { $in: [] } });
        createdCountFilter.$and.push({ _id: { $in: [] } });
      } else {
        if (
          creatorUser.created_business &&
          Array.isArray(creatorUser.created_business)
        ) {
          createdBusinessIdsToCount = creatorUser.created_business;
        }
        if (createdBusinessIdsToCount.length > 0) {
          filter.$and.push({ _id: { $in: createdBusinessIdsToCount } });
          createdCountFilter.$and.push({
            _id: { $in: createdBusinessIdsToCount },
          });
        } else {
          filter.$and.push({ _id: { $in: [] } });
          createdCountFilter.$and.push({ _id: { $in: [] } });
        }
      }
    }
    // 2. telecallerId (Next Priority if createdBy is not present)
    else if (telecallerId) {
      targetUserFound = true;
      const telecaller = await Telecaller.findOne({ telecallerId });
      if (!telecaller) {
        return res.status(404).json({ message: "Telecaller not found" });
      }
      if (
        telecaller.created_business &&
        Array.isArray(telecaller.created_business)
      ) {
        createdBusinessIdsToCount = telecaller.created_business;
      }
      const assignedCategories = telecaller.assignCategories.map((c) =>
        c.category.trim()
      );
      const assignedCities = telecaller.assignCities.map((c) => c.city.trim());
      const telecallerOrConditions = [{ telecallerId: telecallerId }];
      if (assignedCategories.length > 0)
        telecallerOrConditions.push({ category: { $in: assignedCategories } });
      if (assignedCities.length > 0)
        telecallerOrConditions.push({ city: { $in: assignedCities } });
      if (telecallerOrConditions.length > 0) {
        filter.$and.push({ $or: telecallerOrConditions });
      }
      if (createdBusinessIdsToCount.length > 0) {
        createdCountFilter.$and.push({
          _id: { $in: createdBusinessIdsToCount },
        });
      } else {
        createdCountFilter.$and.push({ _id: { $in: [] } });
      }
    }
    // 3. bdeId (Lowest Priority if createdBy and telecallerId are not present)
    else if (bdeId) {
      targetUserFound = true;
      const bde = await BDE.findOne({ bdeId });
      if (!bde) {
        return res.status(404).json({ message: "BDE not found" });
      }
      if (bde.created_business && Array.isArray(bde.created_business)) {
        createdBusinessIdsToCount = bde.created_business;
      }
      const bdeAssignedCategories = bde.assignCategories.map((c) =>
        c.category.trim()
      );
      const bdeAssignedCities = bde.assignCities.map((c) => c.city.trim());
      const bdeOrConditions = [{ bdeId: bdeId }];

      if (byTagAppointment === "true") {
        bdeOrConditions.push({
          $or: [
            { tagAppointment: bdeId },
            ...(bdeAssignedCategories.length > 0
              ? [{ category: { $in: bdeAssignedCategories } }]
              : []),
          ],
        });
      } else {
        if (bdeAssignedCategories.length > 0)
          bdeOrConditions.push({ category: { $in: bdeAssignedCategories } });
        if (bdeAssignedCities.length > 0)
          bdeOrConditions.push({ city: { $in: bdeAssignedCities } });
      }
      if (bdeOrConditions.length > 0) {
        filter.$and.push({ $or: bdeOrConditions });
      }
      if (createdBusinessIdsToCount.length > 0) {
        createdCountFilter.$and.push({
          _id: { $in: createdBusinessIdsToCount },
        });
      } else {
        createdCountFilter.$and.push({ _id: { $in: [] } });
      }
    }
    // 4. digitalMarketerId (Handle separately, if it should combine with other roles)
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
      const dmOrConditions = [];
      if (assignedCategories.length > 0) {
        dmOrConditions.push({ category: { $in: assignedCategories } });
      }
      if (assignedCities.length > 0) {
        dmOrConditions.push({ city: { $in: assignedCities } });
      }
      if (dmOrConditions.length > 0) {
        filter.$and.push({ $or: dmOrConditions });
      }
      if (
        !targetUserFound &&
        digitalMarketer.created_business &&
        Array.isArray(digitalMarketer.created_business)
      ) {
        createdBusinessIdsToCount = digitalMarketer.created_business;
        if (createdBusinessIdsToCount.length > 0) {
          createdCountFilter.$and.push({
            _id: { $in: createdBusinessIdsToCount },
          });
        } else {
          createdCountFilter.$and.push({ _id: { $in: [] } });
        }
      }
    }

    // Finalize createdCountFilter based on the priority chain
    if (!targetUserFound && createdBusinessIdsToCount.length === 0) {
      // This block ensures that if no specific user was found (createdBy, telecallerId, bdeId, digitalMarketerId),
      // the createdCountFilter doesn't get an unnecessary `_id: { $in: [] }` if it should count all.
      // It should already be a clone of baseFilter + general category/city filters.
    }

    // Clean up empty $and arrays from all filters
    if (filter.$and && filter.$and.length === 0) {
      delete filter.$and;
    }
    if (
      totalCountFilterForCreatedAndOverallWithoutDates.$and &&
      totalCountFilterForCreatedAndOverallWithoutDates.$and.length === 0
    ) {
      delete totalCountFilterForCreatedAndOverallWithoutDates.$and;
    }
    if (createdCountFilter.$and && createdCountFilter.$and.length === 0) {
      delete createdCountFilter.$and;
    }

    // --- Sorting ---
    let sort = {};
    sort = { tagAppointment: -1 };
    if (appointmentDate === "true") {
      sort.appointmentDate = -1;
    } else {
      sort.createdAt = -1;
    }

    // --- Pagination ---
    const pageNumber = Math.max(1, parseInt(page));
    const skip = (pageNumber - 1) * parseInt(limit);

    // --- Fetch Businesses ---
    const businesses = await business
      .find(filter) // Uses 'filter' (includes ALL filters, including date filters)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // --- Counts ---
    // Calculate the total count of businesses matching ALL filters (including dates)
    const filteredBusinessesCount = await business.countDocuments(filter);
    const totalPages = Math.ceil(filteredBusinessesCount / limit);

    // created_business_count still uses the filter that excludes date criteria
    const created_business_count = await business.countDocuments(
      createdCountFilter
    );

    // --- MODIFIED START ---
    // New property: Grand total of all businesses in the database (no filters)
    const grandTotalBusinesses = await business.countDocuments({});
    // --- MODIFIED END ---

    const [FollowupCount, appointmentCount, visitCount, dealCloseCount] =
      await Promise.all([
        business.countDocuments({ ...filter, status: "Followup" }), // Uses 'filter' (includes date filters)
        business.countDocuments({ ...filter, status: "Appointment Generated" }),
        business.countDocuments({ ...filter, status: "Visited" }),

        business.countDocuments({ ...filter, status: "Deal Closed" }), // Uses 'filter' (includes date filters)
      ]);

    // --- Send Response ---
    res.status(200).json({
      businesses,
      totalPages,
      currentPage: parseInt(page),
      totalCount: filteredBusinessesCount,
      statuscount: {
        grandTotalBusinesses,
        FollowupCount,
        appointmentCount,
        visitCount,
        dealCloseCount,
        created_business_count,
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
      visit_result,
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
    businessUpdate.visit_result = visit_result || businessUpdate.visit_result;

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

    const deletedBusinessObjectId = businessDelete._id; // Get the MongoDB ObjectId

    // 2. Prepare all the asynchronous operations
    const deleteBusinessPromise = business.deleteOne({ businessId });

    const updateBDEsPromise = BDE.updateMany(
      { created_business: deletedBusinessObjectId },
      { $pull: { created_business: deletedBusinessObjectId } }
    );

    const updateTelecallersPromise = Telecaller.updateMany(
      { created_business: deletedBusinessObjectId },
      { $pull: { created_business: deletedBusinessObjectId } }
    );

    const updateDigitalMarketersPromise = DigitalMarketer.updateMany(
      { created_business: deletedBusinessObjectId },
      { $pull: { created_business: deletedBusinessObjectId } }
    );

    const updateUserPromise = User.updateMany(
      { created_business: deletedBusinessObjectId },
      { $pull: { created_business: deletedBusinessObjectId } }
    );

    await Promise.all([
      deleteBusinessPromise,
      updateBDEsPromise,
      updateTelecallersPromise,
      updateDigitalMarketersPromise,
      updateUserPromise,
    ]);

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
