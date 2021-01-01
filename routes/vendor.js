require("dotenv").config();
var express = require("express");
var multer = require("multer");
var path = require("path");
var axios = require("axios");
var router = express.Router();
var config = require("../config");
var { encryptPWD, comparePWD } = require('../crypto');
var Bcrypt = require("bcryptjs");

var vendorModelSchema = require("../data_models/vendor.model");
var demoOrderSchema = require("../data_models/demoMultiModel");
let promoCodeSchema = require("../data_models/promocode.model");
let settingsSchema = require("../data_models/settings.model");
let deliverytypesSchema = require("../data_models/deliverytype.model");

var imguploader = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/orderimg");
    },
    filename: function (req, file, cb) {
        cb(
            null,
            file.fieldname + "_" + Date.now() + path.extname(file.originalname)
        );
    },
});
var orderimg = multer({ storage: imguploader });

async function GoogleMatrix(fromlocation, tolocation) {
    let link =
        "https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&mode=driving&origins=" +
        fromlocation.latitude +
        "," +
        fromlocation.longitude +
        "&destinations=" +
        tolocation.latitude +
        "," +
        tolocation.longitude +
        "&key=" +
        process.env.GOOGLE_API;
    let results = await axios.get(link);
    let distancebe = results.data.rows[0].elements[0].distance.value;
    console.log("Distance : "+distancebe + " Meter");
    return distancebe / 1000;
}

router.post("/vendor_register", async function(req , res , next){
    const { name, mobileNo , company , email , gstNo , panNumber , lat , address ,
        long , password , FixKm , UnderFixKmCharge , perKmCharge } = req.body;
   
    let encryptPassword = Bcrypt.hashSync(req.body.password, 10);   
    console.log(encryptPassword);
    try {
        let existUser = await vendorModelSchema.find({ mobileNo: mobileNo });
        if(existUser.length == 1){
            res.status(200).json({ IsSuccess: true , Data: [] , Message: "User Already Exist" });
        }else{
            var vendor = await new vendorModelSchema({
                _id: new config.mongoose.Types.ObjectId(),
                name: name,
                mobileNo: mobileNo,
                company: company,
                email: email,
                gstNo: gstNo,
                panNumber: panNumber,
                gpsLocation:{
                    lat: lat,
                    long: long,
                },
                address: address,
                password: encryptPassword,
                FixKm: FixKm == undefined ? "" : FixKm,
                UnderFixKmCharge: UnderFixKmCharge == undefined ? " " : UnderFixKmCharge,
                perKmCharge: perKmCharge == undefined ? " " : perKmCharge,
            });
    
            registerVendor = vendor.save();
            console.log(vendor);
    
            res.status(200).json({ Message: "Vendor Register Successfull...!!!", Data: [vendor], IsSuccess: true });
        }
    } catch (error) {
        res.status(400).json({ Message: "Register Unsuccessfull...!!!", IsSuccess: false });
    }
});

//Update Customer Charges-----31-12-2020---MONIL
router.post("/updateVendorCharge" , async function(req,res,next){
    const { vendorId , FixKm , UnderFixKmCharge , perKmCharge } = req.body;
    try {
        let existVendor = await vendorModelSchema.find({ _id: vendorId });
        if(existVendor.length == 1){
            let updateIs = {
                FixKm: FixKm,
                UnderFixKmCharge: UnderFixKmCharge,
                perKmCharge: perKmCharge,
            }
            let updateRecord = await vendorModelSchema.findByIdAndUpdate(existVendor[0]._id,updateIs);
            res.status(200).json({ IsSuccess: true , Data: 1 , Message: "Data Updated" });
        }else{
            res.status(200).json({ IsSuccess: true , Data: 0 , Message: "Vendor Not Found" });
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Vendor Login ------ Mobile APP(29-12-2020)
router.post("/VendorLogin", async function(req,res,next){
    const { mobileNo } = req.body;
    try {
        let record = await vendorModelSchema.find({ mobileNo: mobileNo });
        if(record.length > 0){
            res.status(200).json({ IsSuccess: true , Data: record , Message: "User LoggedIn" });
        }else{
            res.status(200).json({ IsSuccess: true , Data: [] , Message: "User Not Found" });
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//For WebApplication
router.post("/vendor_login" , async function(req , res, next){
    const { email, password } = req.body;
    
    console.log(req.body);
    try {
        let userEmail = await vendorModelSchema.findOne({ email : email });
        //console.log(userEmail.password);
        if(!userEmail) {
            return response.status(400).send({ message: "The username does not exist" });
        }
        if(!Bcrypt.compareSync(req.body.password, userEmail.password)) {
            return response.status(400).send({ message: "The password is invalid" });
        }
        res.status(200).send({ IsSuccess: true , message: "Vendor Logged In Successfull" });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

function getVendorOrderNumber() {
    let orderNo = "ORD-VND-" + Math.floor(Math.random() * 90000) + 10000;
    return orderNo;
}

function getVendorMultiOrderNumber() {
    let orderNo = "ORDMT-VND-" + Math.floor(Math.random() * 90000) + 10000;
    return orderNo;
}

router.post("/vendorOrderCalc",async function(req,res,next){
    const { 
        vendorId,
        picklat,
        picklong,
        deliveryPoints,
        deliverytype,
        promocode,
        parcelcontents,
        amountCollected,  
    } = req.body;
    try {
        let tempDistanceForALL = 0;

        let fromlocation = { latitude: Number(picklat), longitude: Number(picklong) };
        
        for(let i=0;i<deliveryPoints.length;i++){
            let lat3 = parseFloat(deliveryPoints[i].lat);
            let long3 = parseFloat(deliveryPoints[i].long);
            let tolocation = { latitude: Number(lat3), longitude: Number(long3) };
            
            let totaldistance = await GoogleMatrix(fromlocation, tolocation);
            
            tempDistanceForALL = tempDistanceForALL + totaldistance;
        }
        console.log("Total Distance :"+tempDistanceForALL);

        let prmcodes = await promoCodeSchema.find({ code: promocode });
        let settings = await settingsSchema.find({});
        let delivery = await deliverytypesSchema.find({});
        // console.log("Delivery Check :"+ delivery.length);
        // let totaldistance = await GoogleMatrix(fromlocation, tolocation);
        let totaldistance = tempDistanceForALL;

        let vendorData = await vendorModelSchema.find({ _id: vendorId })

        // let promoused = 0;
       
        // let aboveKmCharge = 0;

        let FixKm = parseFloat(vendorData[0].FixKm);
        let UnderFixKmCharge = parseFloat(vendorData[0].UnderFixKmCharge);
        let perKmCharge = parseFloat(vendorData[0].perKmCharge);

        // console.log(FixKm);
        // console.log(UnderFixKmCharge);
        // console.log(perKmCharge);
        //HERE
        let basicKm = 0;
        let basicAmt = 0;
        let extraKm = 0;
        let extraAmt = 0;
        let extraDeliverycharges = 0;
        let Amount = 0;
        let totalAmt = 0;

        if(totaldistance < FixKm){
            basicKm = totaldistance,
            basicamt = UnderFixKmCharge,
            extrakm = 0,
            extraamt = 0,
            extradeliverycharges = 0,
            amount = basicamt + extraamt + extradeliverycharges,
            totalamt = amount
        }else{
            console.log("Here...!!!")
            let remdis = totaldistance - FixKm,
            basicamt = UnderFixKmCharge,
            extrakm = remdis,
            extraamt = remdis * perKmCharge,
            extradeliverycharges = 0,
            amount = basicamt + extraamt + extradeliverycharges,
            totalamt = amount
            // console.log(totalamt);
            // console.log("Basic AMT :"+basicamt);
            // console.log("Extraa KM :"+extrakm);
            // console.log("Exraa AMT :"+extraamt);
            // console.log("AMT :"+amount);
        }
        // console.log(totalamt);
        console.log("Basic AMT :"+basicamt);
        console.log("Extraa KM :"+extrakm);
        console.log("Exraa AMT :"+extraamt);
        console.log("AMT :"+amount);

    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

router.post("/vendorOrder", orderimg.single("orderimg"), async function(req,res,next){
    var {
        vendorId,
        deliveryType,
        weightLimit,
        // pkName,
        // pkMobileNo,
        // pkAddress,
        // pkLat,
        // pkLong,
        pkCompleteAddress,
        pkContent,
        pkArriveType,
        pkArriveTime,
        deliveryAddresses,
        // collectCash,
        promoCode,
        // amount,
        // discount,
        // additionalAmount,
        // finalAmount,
        schedualDateTime,
    } = req.body;
    let num = getVendorOrderNumber();
    let vendorOrders = [];
    try {
        let pickData = await vendorModelSchema.find({ _id: vendorId });
        for(let i=0;i<deliveryAddresses.length;i++){
            var newVendorMultiOrder = new demoOrderSchema({
                _id: new config.mongoose.Types.ObjectId(),
                orderBy: "vendor",
                orderNo: num,
                multiOrderNo: getVendorMultiOrderNumber(),
                vendorId: vendorId,
                deliveryType: deliveryType,
                schedualDateTime: schedualDateTime,
                weightLimit: weightLimit,
                // orderImg: file == undefined ? "" : file.path,
                pickupPoint: {
                    name: pickData[0].name,
                    mobileNo: pickData[0].mobileNo,
                    address: pickData[0].address,
                    lat: pickData[0].gpsLocation.lat,
                    long: pickData[0].gpsLocation.long,
                    completeAddress: pkCompleteAddress,
                    contents: pkContent,
                    arriveType: pkArriveType,
                    arriveTime: pkArriveTime,
                },
                deliveryPoint:{
                    name: deliveryAddresses[i].dpName,
                    mobileNo: deliveryAddresses[i].dpMobileNo,
                    address: deliveryAddresses[i].dpAddress,
                    lat: deliveryAddresses[i].dpLat,
                    long: deliveryAddresses[i].dpLong,
                    completeAddress: deliveryAddresses[i].dpCompleteAddress,
                    distance: deliveryAddresses[i].dpDistance,
                    vendorBillAmount : deliveryAddresses[i].vendorBillAmount,
                    customerCourierCharge : deliveryAddresses[i].customerCourierCharge,
                    vendorBillFinalAmount : deliveryAddresses[i].vendorBillFinalAmount,
                    courierChargeCollectFromCustomer: deliveryAddresses[i].courierChargeCollectFromCustomer,
                },
                // collectCash: collectCash,
                promoCode: promoCode,
                // amount: "",
                // discount: "",
                // additionalAmount: "",
                // finalAmount: "",
                status: "Order Processing",
                note: "Your order is processing!",
            });
            var placeMultiOrder = await newVendorMultiOrder.save();
            vendorOrders.push(placeMultiOrder);   
        }
        if(vendorOrders.length > 0){
            res.status(200).json({ IsSuccess: true , Count: vendorOrders.length ,Data: vendorOrders , Message: "Order Placed" });
        }else{
            res.status(200).json({ IsSuccess: true , Data: [] , Message: "Order Not Placed" });
        }        
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

router.post("/vendorOrdersList" , async function(req,res,next){
    const { vendorId } = req.body;
    try {
        let orderData = await demoOrderSchema.aggregate([
            { $match : {
                        vendorId: vendorId 
                        }
        }
        ]);
        // let orderData = await demoOrderSchema.find({ vendorId: vendorId });
        console.log(orderData);
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

module.exports = router;