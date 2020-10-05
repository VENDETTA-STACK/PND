const mongoose = require("mongoose");

const orderSettingsSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  PerUnder5KM: { type: Number, required: true },
  PerKM: { type: Number, required: true },
  ReferalPoint: { type: Number, required: true },
  AppLink: { type: String},
  WhatsAppNo: { type: String},
  DefaultWMessage: { type: String},
  AmountPayKM: { type: Number,},
  TermsnConditionURL: { type: String,},
  FromTime: { type: Date,},
  ToTime: { type: Date,},
  NormalDelivery: { type: String,},
  ExpressDelivery: { type: String,},
});

module.exports = mongoose.model("Settings", orderSettingsSchema);
