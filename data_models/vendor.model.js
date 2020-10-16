const mongoose = require("mongoose");
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const vendorSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  courierId: { type: mongoose.Types.ObjectId },
  name: {
    type: String,
    required: true,
  },    
  mobileNo: {
    type: String,
    required: true,
  },
  company: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  gpsLocation: {
    lat: {
        type: String,
        required: true,
    },
    long: {
        type: String,
        required: true,
    },
  },
  gstNo:{
      type: String,
  },
  panNumber:{
      type: String,
  },
  password:{
      type:String
  }
});

module.exports = mongoose.model("Vendor", vendorSchema);
