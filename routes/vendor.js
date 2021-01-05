require("dotenv").config();
var express = require("express");
var multer = require("multer");
var path = require("path");
var axios = require("axios");
var router = express.Router();
var config = require("../config");
var { encryptPWD, comparePWD } = require('../crypto');
var Bcrypt = require("bcryptjs");
var mongoose = require("mongoose");

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
        // deliveryPoints,
        orderNo,
        deliverytype,
        promocode,
        parcelcontents,
        amountCollected,  
    } = req.body;
    try {
        // let tempDistanceForALL = 0;
        let vendorData = await vendorModelSchema.find({ _id: vendorId });
        let orderIs = await demoOrderSchema.find({ orderNo: orderNo});

        let deliveryPoints = [];
        for(let ij=0;ij<orderIs.length;ij++){
            // console.log(orderIs[ij].deliveryPoint);
            let deliveryData = {
                lat : orderIs[ij].deliveryPoint.lat,
                long: orderIs[ij].deliveryPoint.long,
                vendorBillAmount : orderIs[ij].deliveryPoint.vendorBillAmount,
                courierChargeCollectFromCustomer : orderIs[ij].deliveryPoint.courierChargeCollectFromCustomer,
            }
            deliveryPoints.push(deliveryData);
        }
        console.log(deliveryPoints);

        let picklat = vendorData[0].gpsLocation.lat;
        let picklong = vendorData[0].gpsLocation.long;

        console.log(picklat);
        console.log(picklong);

        let fromlocation = { latitude: Number(picklat), longitude: Number(picklong) };

        let prmcodes = await promoCodeSchema.find({ code: promocode });
        let settings = await settingsSchema.find({});
        let delivery = await deliverytypesSchema.find({});

        // let promoused = 0;

        let FixKm = parseFloat(vendorData[0].FixKm);
        let UnderFixKmCharge = parseFloat(vendorData[0].UnderFixKmCharge);
        let perKmCharge = parseFloat(vendorData[0].perKmCharge);

        // console.log(FixKm);
        // console.log(UnderFixKmCharge);
        // console.log(perKmCharge);

        let basicKm = 0;
        let basicCharge = 0;
        let extraaKm = 0;
        let extraaCharge = 0;
        let Amount = 0;
        let totalAmount = 0;
        let addionalCharges = 0;
        let thirdPartyCollection = 0
        let thirdPartyCollectionCharge = 0;

        let DataPass = [];
        let pndBill = [];

        let handlingCharge = parseFloat(settings[0].handling_charges);
        console.log("HAndling : "+handlingCharge);

        for(let j=0;j<deliveryPoints.length;j++){

            let lat3 = parseFloat(deliveryPoints[j].lat);
            let long3 = parseFloat(deliveryPoints[j].long);
            let tolocation = { latitude: Number(lat3), longitude: Number(long3) };
            console.log(tolocation);
            console.log(fromlocation);
            let totaldistance = await GoogleMatrix(fromlocation, tolocation);
            console.log(totaldistance);
            if(amountCollected){
                if(totaldistance < FixKm){
                    basicKm = totaldistance;
                    basicCharge = UnderFixKmCharge;
                    extraaKm = 0;
                    extraaCharge = 0;
                    addionalCharges = 0;
                    thirdPartyCollection = amountCollected;
                    thirdPartyCollectionCharge = parseFloat(thirdPartyCollection) * handlingCharge; 
                    Amount = basicCharge + extraaCharge + addionalCharges + thirdPartyCollectionCharge;
                    totalAmount = Amount; 
                }else{
                    let remKm = totaldistance - FixKm;
                    basicCharge = UnderFixKmCharge;
                    extraaKm = remKm;
                    extraaCharge = extraaKm * perKmCharge;
                    addionalCharges = 0;
                    thirdPartyCollection = amountCollected;
                    thirdPartyCollectionCharge = parseFloat(thirdPartyCollection) * handlingCharge;
                    Amount = basicCharge + extraaCharge + addionalCharges + thirdPartyCollectionCharge;
                    totalAmount = Amount;
                }
            }else{
                console.log("Here...!!!")
                if(totaldistance < FixKm){
                    basicKm = totaldistance;
                    basicCharge = UnderFixKmCharge;
                    extraaKm = 0;
                    extraaCharge = 0;
                    addionalCharges = 0;
                    Amount = basicCharge + extraaCharge + addionalCharges;
                    totalAmount = Amount; 
                }else{
                    let remKm = totaldistance - FixKm;
                    basicCharge = UnderFixKmCharge;
                    extraaKm = remKm;
                    extraaCharge = extraaKm * perKmCharge;
                    addionalCharges = 0;
                    Amount = basicCharge + extraaCharge + addionalCharges;
                    totalAmount = Amount;
                }
            }
            let courierChargeCollectFromCust = deliveryPoints[j].courierChargeCollectFromCustomer;
            let vendorAmount = parseFloat(deliveryPoints[j].vendorBillAmount);
            let totalVendorBill = 0;

            if(courierChargeCollectFromCust == false){
                totalVendorBill = totalAmount + vendorAmount;
            }else{
                totalVendorBill = vendorAmount;
            }
            let sendData = {
                VendorAmount : vendorAmount,
                CouriersChargeIs : totalAmount,
                VendorTotalBill : totalVendorBill
            }
            DataPass.push(sendData);
        }
        console.log(DataPass);
        let pndTotalAmountCollect = 0;
        let pndTotalCourierCharge = 0;

        for(let k=0;k<DataPass.length;k++){
            // console.log(DataPass[k]);
            pndTotalAmountCollect = pndTotalAmountCollect + parseFloat(DataPass[k].VendorTotalBill);
            pndTotalCourierCharge = pndTotalCourierCharge + parseFloat(DataPass[k].CouriersChargeIs);
        }
        console.log(pndTotalAmountCollect);
        console.log(pndTotalCourierCharge);

        let finalPNDBill = parseFloat(pndTotalAmountCollect) - parseFloat(pndTotalCourierCharge);

        for(let jk=0;jk<orderIs.length;jk++){
            let updateIs = {
                "deliveryPoint.customerCourierCharge" : DataPass[jk].CouriersChargeIs,
                "deliveryPoint.vendorBillFinalAmount" : DataPass[jk].VendorTotalBill,
                "chargeOfPND" : finalPNDBill,
            }
            let vendorOrderMTNum = orderIs[jk].multiOrderNo;
            // console.log(vendorOrderMTNum);
            let updateInOrder = await demoOrderSchema.findOneAndUpdate({ multiOrderNo: vendorOrderMTNum},updateIs);
        }
        // let updateIs = {

        // };
        // let updateInOrder = await demoOrderSchema.findOneAndUpdate({ orderNo: orderNo},updateIs)

        res.status(200).json({ 
                               IsSuccess: true,
                               PndTotalAmountCollect: pndTotalAmountCollect,
                               PndTotalCourierCharge: pndTotalCourierCharge,
                               PNDBill : finalPNDBill,
                               Data: DataPass, 
                               Message: "calculation Done" 
                            })
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
    const file = req.file;
    let num = getVendorOrderNumber();
    let vendorOrders = [];
    try {
        let pickData = await vendorModelSchema.find({ _id: vendorId });
        // if(pickData[0].isApprove == true)
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
                orderImg: file == undefined ? "" : file.path,
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

//All Vendor Order Listing-----------04/01/2021----MONIL
router.post("/vendorOrdersList" , async function(req,res,next){
    const { vendorId , ofDate } = req.body;
    
    try {
        let orderData;
        // console.log(isoDate1);
        // console.log(isoDate2);
        if(ofDate){
            let isoDate1 = convertStringDateToISO(ofDate);
            let isoDate2 = convertStringDateToISOPlusOne(ofDate);
            
            orderData = await demoOrderSchema.find({
                vendorId: mongoose.Types.ObjectId(vendorId),
                dateTime: {
                    $gte: isoDate1,
                    $lt: isoDate2,
                },
            })
        }else{
            orderData = await demoOrderSchema.aggregate([
                { 
                    $match : {
                            vendorId: mongoose.Types.ObjectId(vendorId) 
                            }
                }
            ]);
        }
        
        let vendorOrderData = [];
        for(let i=0;i<orderData.length;i++){
            let deliveryNo = orderData[i].multiOrderNo;
            let deliveryData = orderData[i].deliveryPoint;
            let deliveryDate = orderData[i].dateTime;
            let vendorAmountCollect = orderData[i].deliveryPoint.vendorBillAmount == null ? 0 : orderData[i].deliveryPoint.vendorBillAmount;
            let courierCharge = orderData[i].deliveryPoint.customerCourierCharge == null ? 0 : orderData[i].deliveryPoint.customerCourierCharge;
            let courierChargeCollectFromCustomerIs = orderData[i].deliveryPoint.courierChargeCollectFromCustomer == null ? 0 : orderData[i].deliveryPoint.courierChargeCollectFromCustomer;
            let vendorBill = orderData[i].deliveryPoint.vendorBillFinalAmount == null ? 0 : orderData[i].deliveryPoint.vendorBillFinalAmount;
            let PNDBill = orderData[i].chargeOfPND;
            let orderDataSend = {
                DeliveryNo: deliveryNo,
                DeliveryData: deliveryData,
                DeliveryDate: deliveryDate,
                VendorAmountCollect: vendorAmountCollect,
                CourierCharge: courierCharge,
                CourierChargeCollectFromCustomerIs: courierChargeCollectFromCustomerIs,
                VendorBill : vendorBill,
            }
            vendorOrderData.push(orderDataSend);
        }
        let pndBillTotalCourierCharge = 0;
        let pndTotalVendorAmount = 0;
        
        for(let jk=0;jk<vendorOrderData.length;jk++){
            pndBillTotalCourierCharge = pndBillTotalCourierCharge + parseFloat(vendorOrderData[jk].CourierCharge);
            
            pndTotalVendorAmount = pndTotalVendorAmount + parseFloat(vendorOrderData[jk].VendorBill);
        }
        // console.log(`Courier : ${pndBillTotalCourierCharge}`);
        // console.log(`Total Amount : ${pndTotalVendorAmount}`);
        if(vendorOrderData.length > 0){
            res.status(200).json({ 
                IsSuccess: true,
                PNDCourierCharge: pndBillTotalCourierCharge, 
                PNDBill: pndTotalVendorAmount, 
                DeliveryCount: orderData.length, 
                Data: vendorOrderData, 
                Message: "Vendor Order Found" 
            });
        }else{
            res.status(200).json({ IsSuccess: true , Data: [] , Message: "Order Not Found" })
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Get DeliverOrder Details------------04/01/2021--------MONIL
router.post("/getDeliveryOrderDetails", async function(req,res,next){
    const { orderMTNo } = req.body;
    try {
        let orderIs = await demoOrderSchema.find({ multiOrderNo: orderMTNo });
        if(orderIs.length == 1){
            res.status(200).json({ IsSuccess: true, Data: orderIs , Message: "Order Data Found" });
        }else{
            res.status(200).json({ IsSuccess: true, Data: [] , Message: "Order Not Found" });
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Get All Vendor List 
router.post("/getAllVendor", async function(req,res,next){
    try {
        let vendorsAre = await vendorModelSchema.find();
        if(vendorsAre.length > 0){
            res.status(200).json({ IsSuccess: true , Data: vendorsAre , Message: "Vendors Found" });
        }else{
            res.status(200).json({ IsSuccess: true , Data: [] , Message: "Empty Vendors List" });
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Get All Vendor Orders Listing
router.post("/getAllVendorOrderListing",async function(req,res,next){
    const { ofDate } = req.body;
    try {
        
        // let vendorOrderIs = await demoOrderSchema.find({ 
        //                                             orderBy : "vendor",
        //                                             dateTime: {
        //                                                 $gte: isoDate1,
        //                                                 $lt: isoDate2,
        //                                             },
        //                                         })
        //                                          .populate({
        //                                              path: "vendorId"
        //                                          });
        let vendorsData = await vendorModelSchema.find();
        // let vendorIds = [];
        // let vendorsOrders = [];
        var vendorOrderData = [];
        for(let j=0;j<vendorsData.length;j++){
            // console.log(vendorsData[j]._id);
            // vendorIds.push(vendorsData[j]._id);
            let orderIs;
            if(ofDate){
                let isoDate1 = convertStringDateToISO(ofDate);
                let isoDate2 = convertStringDateToISOPlusOne(ofDate);
                orderIs = await demoOrderSchema.find({ 
                    vendorId: vendorsData[j]._id,
                    dateTime: {
                        $gte: isoDate1,
                        $lt:  isoDate2,
                    }, 
                })
               .populate({
                   path: "vendorId",
                   select: "name mobileNo"
               });
            }else{
                console.log("-------------------Here------------------------------------------")
                orderIs = await demoOrderSchema.find({ 
                    vendorId: vendorsData[j]._id, 
                })
               .populate({
                   path: "vendorId",
                   select: "name mobileNo"
               });
            }
            // console.log(orderIs.length);
            if(orderIs.length > 0){
                // console.log(orderIs[j]._id);
                for(let i=0;i<orderIs.length;i++){
                    // console.log("Vendor Id : " + orderIs[i].vendorId);
                    // console.log(orderIs[i].vendorId._id);
                    let deliveryNo = orderIs[i].multiOrderNo;
                    let VendorId = orderIs[i].vendorId._id;
                    let VendorName = orderIs[i].vendorId.name;
                    let VendorMobileNo = orderIs[i].vendorId.mobileNo;
                    let deliveryTo = orderIs[i].deliveryPoint;
                    let vendorAmountCollect = orderIs[i].deliveryPoint.vendorBillAmount == null ? 0 : orderIs[i].deliveryPoint.vendorBillAmount;
                    let courierCharge = orderIs[i].deliveryPoint.customerCourierCharge == null ? 0 : orderIs[i].deliveryPoint.customerCourierCharge;
                    let courierChargeCollectFromCustomerIs = orderIs[i].deliveryPoint.courierChargeCollectFromCustomer == null ? 0 : orderIs[i].deliveryPoint.courierChargeCollectFromCustomer;
                    let vendorBill = orderIs[i].deliveryPoint.vendorBillFinalAmount == null ? 0 : orderIs[i].deliveryPoint.vendorBillFinalAmount;
                    // let PNDBill = orderIs[i].chargeOfPND;
                    let deliveryDate = orderIs[i].dateTime;
                    let orderDataSend = {
                        DeliveryNo: deliveryNo,
                        VendorId: VendorId,
                        VendorName: VendorName,
                        DeliveryData: deliveryTo,
                        VendorMobileNo: VendorMobileNo,
                        VendorAmountCollect: vendorAmountCollect,
                        CourierCharge: courierCharge,
                        CourierChargeCollectFromCustomerIs: courierChargeCollectFromCustomerIs,
                        VendorBill : vendorBill,
                        DeliveryDate : deliveryDate,
                        // PNDBill : PNDBill
                    }
                    // console.log(orderDataSend);
                    vendorOrderData.push(orderDataSend);
                }
            }
            // console.log(vendorOrderData);
        }

        // console.log(vendorOrderData);
        if(vendorOrderData.length > 0){
            res.status(200).json({ IsSuccess: true , Data: vendorOrderData , Message: "All Vendor Orders Found" });
        }else{
            res.status(200).json({ IsSuccess: true , Data: [] , Message: "Orders Not Found" });
        }
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message });
    }
});

//Delete Records from demoorder Table
router.post("/delVendorOrder", async function(req,res,next){
    try {
        let delRecord = await demoOrderSchema.deleteMany();
        res.status(200).json({ IsSuccess: true , Data: 1 , Message: "Vendor Order Deleted" });
    } catch (error) {
        res.status(500).json({ IsSuccess: false , Message: error.message })
    }
});

//Convert String Date to ISO
function convertStringDateToISO(date){
    var dateList = date;
    // console.log(dateList.split("/"));
    let list = dateList.split("/");
    
    let dISO = list[2] + "-" + list[1] + "-" + list[0] + "T" + "00:00:00.00Z";
    // console.log(dISO);
    return dISO;
}

function convertStringDateToISOPlusOne(date){
    var dateList = date;
    // console.log(dateList.split("/"));
    let list = dateList.split("/");
    let datee = parseFloat(list[0]) + 1;
    
    // console.log(datee);
    if(datee < 10){
        datee = "0" + String(datee); 
    }
    // console.log(datee);

    let dISO = list[2] + "-" + list[1] + "-" + datee + "T" + "00:00:00.00Z";
    // console.log(dISO);
    return dISO;
}

//Find Unique values from List
function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

module.exports = router;