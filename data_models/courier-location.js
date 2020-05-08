const mongoose = require('mongoose');

const courierLocationSchema = mongoose.Schema({
    _id:mongoose.Schema.Types.ObjectId,
    courierId:{type:mongoose.Types.ObjectId,ref:'Couriers'},
    latitude:{
        type:String,
        required:true},
    longitude:{
        type:String,
        required:true},
    duty:{
        type:String,
        required:true},
    parcel:{
        type:Number,
        required:true},
    dateTime:{
        type:Date,
        default:Date.now},
});

module.exports = mongoose.model('locations',courierLocationSchema);