const mongoose = require("mongoose");

const categorySchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    title: {
      type: String,
    },
    image: {
      type: String,
    },
    dateTime: {
        type: Date,
        default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  });
  
  module.exports = mongoose.model("parcelcategories", categorySchema);
  