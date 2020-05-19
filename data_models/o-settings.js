const mongoose = require('mongoose');

const orderSettingsSchema = mongoose.Schema({
    _id:mongoose.Schema.Types.ObjectId,
    PerUnder5KM:{type:Number,required:true},
    PerKM:{type:Number,required:true},
    ExpDelivery:{type:Number,required:true},
    ReferalPoint:{type:Number,required:true}
});

module.exports = mongoose.model('Settings',orderSettingsSchema);