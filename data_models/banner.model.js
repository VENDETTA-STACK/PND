const mongoose = require("mongoose");

const bannerSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    title: {
      type: String,
    },
    description: {
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
  
  module.exports = mongoose.model("banners", bannerSchema);
  