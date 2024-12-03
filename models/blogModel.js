const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    blogId: {
      type: String,
      unique: true,
      required: true,
    },
    blogTitle: {
      type: String,
    },
    publisherName: {
      type: String,
    },
    publisherProfileLink: {
      type: String,
    },
    category: {
      type: String,
    },
    blogThumbnails: {
      secure_url: {
        type: String,
        required: function () {
          return !this.isdraft; // Required only if it's not a draft
        },
      },
      public_id: {
        type: String,
        required: function () {
          return !this.isdraft; // Required only if it's not a draft
        },
      },
    },
    metadescription: {
      type: String,
    },
    bulletPoints: [String],
    writeBlog: {
      type: String,
    },
    active: { type: Boolean, default: true },
    isdraft: { type: Boolean, default: false },
    viewsCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Blogs", blogSchema);
