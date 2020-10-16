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
    quantity: {
        type:String,
        require:true
    }
});

module.exports = mongoose.model("sumulOrder",sumulOrderSchema);