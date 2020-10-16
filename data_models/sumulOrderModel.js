var mongoose = require('mongoose');

var sumulOrderSchema = mongoose.Schema({
    name: {
        type:String,
        require: true
    },
    mobileNo: {
        type:String
    },
    dateTime: {
        type:Date,
        default: Date.now
    },
    address: {
        type:String,
        require: true
    },
    qty250: {
        type:String,
        require:true
    },
    qty500: {
        type:String,
        require:true
    },
    qty1000: {
        type:String,
        require:true
    },
});

module.exports = mongoose.model("sumulOrder",sumulOrderSchema);