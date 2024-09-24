const WaImage = require("../models/wptemplateimageModel");
const cloudinary = require("cloudinary").v2;
const path = require("path");
// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Generate auto-incremental waimageId
const generateWaImageId = async () => {
  const images = await WaImage.find({}, { waimageId: 1, _id: 0 }).sort({
    waimageId: 1,
  });
  const imageIds = images.map((image) =>
    parseInt(image.waimageId.replace("waimageId", ""), 10)
  );

  let waimageId = 1;
  for (let i = 0; i < imageIds.length; i++) {
    if (waimageId < imageIds[i]) {
      break;
    }
    waimageId++;
  }

  return `waimageId${String(waimageId).padStart(4, "0")}`;
};

// Create (Upload) Image(s) or Document(s)
exports.createFiles = async (req, res) => {
  try {
    const files = req.files.documents || req.files.images; // Get files from express-fileupload

    if (!files) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const savedFiles = [];
    const filesArray = Array.isArray(files) ? files : [files]; // Handle both single and multiple files

    for (const file of filesArray) {
      const waimageId = await generateWaImageId();

      // Determine file type and set the appropriate Cloudinary folder and resource type
      const isImage = file.mimetype.startsWith("image/");
      const folder = isImage ? "rebootwaimage" : "rebootwadocument";
      const resource_type = isImage ? "image" : "auto";

      const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: folder,
        resource_type: resource_type, // Set the resource type based on file type
        public_id: `${folder}/${path.parse(file.name).name}`, // Use the file name without extension as public_id
      });

      // Save file data to the database
      const newFile = new WaImage({
        waimageId,
        waimagename: {
          secure_url: result.secure_url,
          public_id: result.public_id,
          original_filename: file.name,
        },
      });

      await newFile.save();
      savedFiles.push(newFile);
    }

    res
      .status(201)
      .json({ message: "Files uploaded successfully", savedFiles });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ message: "Failed to upload files", error });
  }
};

// Get (Fetch) All Files
exports.getAllFiles = async (req, res) => {
  try {
    const files = await WaImage.find();
    res.status(200).json(files);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch files", error });
  }
};

// Delete File
exports.deleteFile = async (req, res) => {
  try {
    const { id } = req.params;
    const file = await WaImage.findOne({ waimageId: id });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(file.waimagename.public_id, {
      resource_type: "raw", // Set resource type as raw for non-image files
    });

    // Delete from the database
    await WaImage.deleteOne({ waimageId: id });

    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete file", error });
  }
};
