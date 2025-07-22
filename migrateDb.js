const mongoose = require("mongoose");
const dotenv = require("dotenv");
const businessModel = require("./models/businessModel");
const cityModel = require("./models/cityModel");
const categoryModel = require("./models/categoryModel");
const leadsourceModel = require("./models/leadsourceModel");

dotenv.config({ path: "./.env" });

// Assuming you have your Mongoose models defined and exported
// Replace with the actual paths to your model files

// --- Configuration ---

async function migrateCityStringsToObjectIds() {
  let connection;
  try {
    connection = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Add any other connection options you use (e.g., authSource, user, pass)
    });
    console.log("MongoDB connected successfully for migration.");

    let convertedCount = 0;
    let notFoundCount = 0;

    // Find all businesses where 'city' is currently a string
    const businessesToMigrate = await businessModel
      .find({
        source: { $type: 2 }, // BSON type 2 is String
      })
      .setOptions({ strictQuery: false })
      .lean();

    console.log(
      `Found ${businessesToMigrate.length} businesses with string city names to migrate.`
    );

    for (const business of businessesToMigrate) {
      const cityNameString = business.source;

      // Find the corresponding CityName document to get its ObjectId
      const cityDoc = await leadsourceModel.findOne({
        sourcename: cityNameString,
      });

      if (cityDoc) {
        // If a matching CityName document is found, update the business
        business.category = cityDoc._id; // Set the city to the ObjectId
        await businessModel.updateOne(
          { _id: business._id },
          { $set: { source: cityDoc._id } }
        ); // Save the updated business document
        convertedCount++;
        // console.log(`Updated business ${business._id}: '${cityNameString}' -> ${cityDoc._id}`);
      } else {
        // If no matching CityName document is found
        notFoundCount++;
        console.warn(
          `Warning: City '${cityNameString}' (from business ${business._id}) not found in CityName model. This business was NOT updated.`
        );
        // You might want to log these to a file or a separate collection for review
      }
    }

    console.log("\n--- Migration Summary ---");
    console.log(
      `Successfully converted ${convertedCount} businesses from string city to ObjectId.`
    );
    console.log(
      `Skipped ${notFoundCount} businesses because their city string had no matching ObjectId in the CityName collection.`
    );
    console.log("Migration process completed.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log("MongoDB disconnected.");
    }
  }
}

// --- Run the migration ---
migrateCityStringsToObjectIds();
