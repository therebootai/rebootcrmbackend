const mongoose = require("mongoose");

const slugify = require("slugify");

const blogSchema = new mongoose.Schema(
  {
    blogId: {
      type: String,
      unique: true,
      required: true,
    },
    slug: { type: String, required: true, unique: true },
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

blogSchema.pre("save", function (next) {
  // Only generate a slug if it's not already set and if blogTitle is present
  if (this.blogTitle && !this.slug) {
    this.slug = slugify(this.blogTitle, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.model("Blogs", blogSchema);
