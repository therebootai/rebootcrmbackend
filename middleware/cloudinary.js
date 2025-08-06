const cloudinary = require("cloudinary").v2;
require("dotenv").config();

cloudinary.config({
  cloud_name: "dcphm4jaf",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.uploadFile = async (tempFilePath, fileType) => {
  if (!tempFilePath) {
    throw new Error("No file provided or incorrect file path");
  }
  try {
    let folderName = "images";
    let format = "jpg";
    let resourceType = "image";
    if (fileType == "application/pdf") {
      folderName = "pdf";
      format = "pdf";
      resourceType = "raw";
    }

    const result = await cloudinary.uploader.upload(tempFilePath, {
      folder: "reboots/" + folderName,
      resource_type: resourceType,
      format,
    });

    return result;
  } catch (error) {
    console.error("Error uploading file:", error);
    return error;
  }
};

exports.deleteFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Error uploading file:", error);
    return error;
  }
};
