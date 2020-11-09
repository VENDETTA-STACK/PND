//INITIATING LIBRARIES
require("dotenv").config();
var path = require("path");
var fs = require("fs");
var axios = require("axios");
var multer = require("multer");
var express = require("express");
var config = require("../config");
var router = express.Router();
var arraySort = require("array-sort");
// For Third Party Service Call
var request = require('request');
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

//SCHEMAS
var orderSchema = require("../data_models/order.model");
var courierSchema = require("../data_models/courier.signup.model");
var requestSchema = require("../data_models/order.request.model");
var settingsSchema = require("../data_models/settings.model");
var ExtatimeSchema = require("../data_models/extratime.model");
var customerSchema = require("../data_models/customer.signup.model");
var usedpromoSchema = require("../data_models/used.promocode.model");
var promoCodeSchema = require("../data_models/promocode.model");
var locationLoggerSchema = require("../data_models/location.logger.model");
var courierNotificationSchema = require("../data_models/courier.notification.model");
var deliverytypesSchema = require("../data_models/deliverytype.model");
var categorySchema = require('../data_models/category.model');
var demoOrderSchema = require('../data_models/demoMultiModel');
const { json } = require("body-parser");

//required functions
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
    console.log(distancebe + " Meter");
    return distancebe / 1000;
}

async function PNDfinder(pickuplat, pickuplong, orderid, deliveryType) {
    let available = [];
    let getpndpartners = await courierSchema
        .find({
            isActive: true,
            isVerified: true,
            "accStatus.flag": true,
        })
        .select("id fcmToken");

    if (deliveryType == "Normal Delivery") {
        for (let i = 0; i < getpndpartners.length; i++) {
            let partnerlocation = await currentLocation(getpndpartners[i].id);
            if (
                (partnerlocation.duty == "ON") &
                (Number(partnerlocation.parcel) < 3)
            ) {
                let totalrequests = await requestSchema.countDocuments({
                    orderId: orderid,
                });
                let partnerrequest = await requestSchema.find({
                    courierId: getpndpartners[i].id,
                    orderId: orderid,
                });
                if (totalrequests <= 4) {
                    if (partnerrequest.length == 0) {
                        let pickupcoords = { latitude: pickuplat, longitude: pickuplong };
                        let partnercoords = {
                            latitude: partnerlocation.latitude,
                            longitude: partnerlocation.longitude,
                        };
                        console.log(partnerlocation);
                        console.log(pickupcoords, partnercoords)
                        let distancebtnpp = await GoogleMatrix(pickupcoords, partnercoords);
                        if (distancebtnpp <= 15) {
                            available.push({
                                courierId: getpndpartners[i].id,
                                orderId: orderid,
                                distance: distancebtnpp,
                                status: "Pending",
                                fcmToken: getpndpartners[i].fcmToken,
                                reason: "",
                            });
                        }
                    }
                }
            }
        }
    } else {
        for (let i = 0; i < getpndpartners.length; i++) {
            let partnerlocation = await currentLocation(getpndpartners[i].id);
            if (
                (partnerlocation.duty == "ON") &
                (Number(partnerlocation.parcel) == 0)
            ) {
                let totalrequests = await requestSchema.countDocuments({
                    orderId: orderid,
                });
                let partnerrequest = await requestSchema.find({
                    courierId: getpndpartners[i].id,
                    orderId: orderid,
                });
                if (totalrequests <= 4) {
                    if (partnerrequest.length == 0) {
                        let pickupcoords = { latitude: pickuplat, longitude: pickuplong };
                        let partnercoords = {
                            latitude: partnerlocation.latitude,
                            longitude: partnerlocation.longitude,
                        };
                        let distancebtnpp = await GoogleMatrix(pickupcoords, partnercoords);
                        if (distancebtnpp <= 15) {
                            available.push({
                                courierId: getpndpartners[i].id,
                                orderId: orderid,
                                distance: distancebtnpp,
                                status: "Pending",
                                fcmToken: getpndpartners[i].fcmToken,
                                reason: "",
                            });
                        }
                    }
                }
            }
        }
    }

    return available;
}

function getOrderNumber() {
    let orderNo = "ORD-" + Math.floor(Math.random() * 90000) + 10000;
    return orderNo;
}
// send sms
async function sendMessages(mobileNo, message) {
    // let msgportal =
    //     "http://promosms.itfuturz.com/vendorsms/pushsms.aspx?user=" +
    //     process.env.SMS_USER +
    //     "&password=" +
    //     process.env.SMS_PASS +
    //     "&msisdn=" +
    //     mobileNo +
    //     "&sid=" +
    //     process.env.SMS_SID +
    //     "&msg=" +
    //     message +
    //     "&fl=0&gwid=2";
    let msgportal = "http://websms.mitechsolution.com/api/push.json?apikey=" + process.env.SMS_API + "&route=vtrans&sender=PNDDEL&mobileno=" + mobileNo + "&text= " + message;
    console.log(msgportal);
    axios.get(msgportal);
    var data = await axios.get(msgportal);
    return data;
}

async function currentLocation(courierId) {
    console.log(courierId);
    var CourierRef = config.docref.child(courierId);
    const data = await CourierRef.once("value")
        .then((snapshot) => snapshot.val())
        .catch((err) => err);
    console.log("---------");
    console.log(data);
    console.log("---------");
    return data;
}

//customers app APIs
router.post("/settings", async function (req, res, next) {
    try {
        let getsettings = await settingsSchema.find({});
        let getdeliverytypes = await deliverytypesSchema.find({});

        let predata = [{
            settings: getsettings,
            deliverytypes: getdeliverytypes,
        },];

        res.status(200).json({
            Message: "Settings Found!",
            Data: predata,
            IsSuccess: true,
        });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/ordercalc", async (req, res, next) => {
    const {
        picklat,
        picklong,
        droplat,
        droplong,
        deliverytype,
        promocode,
    } = req.body;

    let fromlocation = { latitude: Number(picklat), longitude: Number(picklong) };
    let tolocation = { latitude: Number(droplat), longitude: Number(droplong) };
    let prmcodes = await promoCodeSchema.find({ code: promocode });
    let settings = await settingsSchema.find({});
    let delivery = await deliverytypesSchema.find({});
    let totaldistance = await GoogleMatrix(fromlocation, tolocation);

    let basickm = 0;
    let basicamt = 0;
    let extrakm = 0;
    let extraamt = 0;
    let extadeliverycharges = 0;
    let promoused = 0;
    let amount = 0;
    let totalamt = 0;

    if (totaldistance <= 5) {
        if (deliverytype == "Normal Delivery") {
            basickm = totaldistance;
            basicamt = settings[0].PerUnder5KM;
            extrakm = 0;
            extraamt = 0;
            extadeliverycharges = delivery[0].cost;
            amount = basicamt + extraamt + extadeliverycharges;
            promoused =
                prmcodes.length != 0 ? (amount * prmcodes[0].discount) / 100 : 0;
            totalamt = amount - promoused;
        } else {
            for (let i = 1; i < delivery.length; i++) {
                if (deliverytype == delivery[i].title) {
                    basickm = totaldistance;
                    basicamt = settings[0].PerUnder5KM;
                    extrakm = 0;
                    extraamt = 0;
                    extadeliverycharges = delivery[i].cost;
                    amount = basicamt + extraamt + extadeliverycharges;
                    promoused =
                        prmcodes.length != 0 ? (amount * prmcodes[0].discount) / 100 : 0;
                    totalamt = amount - promoused;
                }
            }
        }
    } else {
        if (deliverytype == "Normal Delivery") {
            let remdis = totaldistance - 5;
            basickm = 5;
            basicamt = settings[0].PerUnder5KM;
            extrakm = remdis;
            extraamt = remdis * settings[0].PerKM;
            extadeliverycharges = delivery[0].cost;
            amount = basicamt + extraamt + extadeliverycharges;
            promoused =
                prmcodes.length != 0 ? (amount * prmcodes[0].discount) / 100 : 0;
            totalamt = amount - promoused;
        } else {
            for (let i = 1; i < delivery.length; i++) {
                if (deliverytype == delivery[i].title) {
                    let remdis = totaldistance - 5;
                    basickm = 5;
                    basicamt = settings[0].PerUnder5KM;
                    extrakm = remdis;
                    extraamt = remdis * settings[0].PerKM;
                    extadeliverycharges = delivery[i].cost;
                    amount = basicamt + extraamt + extadeliverycharges;
                    promoused =
                        prmcodes.length != 0 ? (amount * prmcodes[0].discount) / 100 : 0;
                    totalamt = amount - promoused;
                }
            }
        }
    }

    let dataset = [{
        totaldistance: totaldistance.toFixed(2),
        basickm: basickm.toFixed(2),
        basicamt: basicamt.toFixed(2),
        extrakm: extrakm.toFixed(2),
        extraamt: extraamt.toFixed(2),
        extadeliverycharges: extadeliverycharges.toFixed(2),
        amount: amount.toFixed(2),
        promoused: promoused.toFixed(2),
        totalamt: totalamt.toFixed(2),
    },];

    res.json({ Message: "Calculation Found!", Data: dataset, IsSuccess: true });
});


router.post("/ordercalcV2", async (req, res, next) => {
    const {
        picklat,
        picklong,
        droplat,
        droplong,
        deliverytype,
        promocode,
        parcelcontents
    } = req.body;

    console.log("OrderCalcV2 Request Body.................!!!!");
    console.log(req.body);

    let fromlocation = { latitude: Number(picklat), longitude: Number(picklong) };
    let tolocation = { latitude: Number(droplat), longitude: Number(droplong) };
    let prmcodes = await promoCodeSchema.find({ code: promocode });
    let settings = await settingsSchema.find({});
    let delivery = await deliverytypesSchema.find({});
    let totaldistance = await GoogleMatrix(fromlocation, tolocation);

    let basickm = 0;
    let basicamt = 0;
    let extrakm = 0;
    let extraamt = 0;
    let extadeliverycharges = 0;
    let promoused = 0;
    let amount = 0;
    let totalamt = 0;

    if (totaldistance <= 5) {
        if (deliverytype == "Normal Delivery") {
            basickm = totaldistance;
            basicamt = settings[0].PerUnder5KM;
            extrakm = 0;
            extraamt = 0;
            extadeliverycharges = delivery[0].cost;
            amount = basicamt + extraamt + extadeliverycharges;
            totalamt = amount;
        } else {
            for (let i = 1; i < delivery.length; i++) {
                if (deliverytype == delivery[i].title) {
                    basickm = totaldistance;
                    basicamt = settings[0].PerUnder5KM;
                    extrakm = 0;
                    extraamt = 0;
                    extadeliverycharges = delivery[i].cost;
                    amount = basicamt + extraamt + extadeliverycharges;
                    totalamt = amount;
                }
            }
        }
    } else {
        if (deliverytype == "Normal Delivery") {
            let remdis = totaldistance - 5;
            basickm = 5;
            basicamt = settings[0].PerUnder5KM;
            extrakm = remdis;
            extraamt = remdis * settings[0].PerKM;
            extadeliverycharges = delivery[0].cost;
            amount = basicamt + extraamt + extadeliverycharges;
            totalamt = amount;
        } else {
            for (let i = 1; i < delivery.length; i++) {
                if (deliverytype == delivery[i].title) {
                    let remdis = totaldistance - 5;
                    basickm = 5;
                    basicamt = settings[0].PerUnder5KM;
                    extrakm = remdis;
                    extraamt = remdis * settings[0].PerKM;
                    extadeliverycharges = delivery[i].cost;
                    amount = basicamt + extraamt + extadeliverycharges;
                    totalamt = amount;
                }
            }
        }
    }

    let distamt = Number(basicamt.toFixed(2)) + Number(extraamt.toFixed(2));
    distamt = (Math.round(distamt) % 10) > 5 ? round(distamt, 10) : round(distamt, 5);
    let note;
    //Find Parcel Content From Database
    let parcelContentsList = [];
    for (let e = 0; e < parcelcontents.length; e++) {
        let data = await categorySchema.findOne({ title: parcelcontents[e] });
        if (e == 0) {
            note = data.note;
        }
        parcelContentsList.push(data);
    }
    console.log("Parcel Contents List..............................!!!");
    console.log(parcelContentsList);
    
    //Find ExtraCharges
    let sortParcelContents = arraySort(parcelContentsList, 'price', { reverse: true });
    let extracharges = 0;
    for (let a = 0; a < sortParcelContents.length; a++) {
        extracharges = extracharges + sortParcelContents[a].price;
    }

    let amt = Number(distamt) + extracharges + Math.ceil(extadeliverycharges.toFixed(2));
    promoused = prmcodes.length != 0 ? (amt * prmcodes[0].discount) / 100 : 0;
    let netamount = amt - Math.ceil(promoused.toFixed(2));

    //TESTING FCMTOKEN
    let AdminMobile = await settingsSchema.find({}).select('AdminMObile1 AdminMObile2 AdminMObile3 AdminMObile4 AdminMObile5 -_id');
    console.log("Admin numbers-------------------------------------------------");
    let AdminNumber1 = AdminMobile[0].AdminMObile1; 
    let AdminNumber2 = AdminMobile[0].AdminMObile2; 
    let AdminNumber3 = AdminMobile[0].AdminMObile3; 
    let AdminNumber4 = AdminMobile[0].AdminMObile4; 
    let AdminNumber5 = AdminMobile[0].AdminMObile5;

    // var findAdminFcmToken = await customerSchema.find({ mobileNo: AdminNumber1 }).select('fcmToken -_id');
    // var findAdminFcmToken2 = await customerSchema.find({ mobileNo: AdminNumber2 }).select('fcmToken -_id');
    // var findAdminFcmToken3 = await customerSchema.find({ mobileNo: AdminNumber3 }).select('fcmToken -_id');
    // var findAdminFcmToken4 = await customerSchema.find({ mobileNo: AdminNumber4 }).select('fcmToken -_id');
    // var findAdminFcmToken5 = await customerSchema.find({ mobileNo: AdminNumber5 }).select('fcmToken -_id');
    // console.log(findAdminFcmToken);
    // var AdminFcmToken = [findAdminFcmToken[0].fcmToken,findAdminFcmToken2[0].fcmToken,findAdminFcmToken3[0].fcmToken,findAdminFcmToken4[0].fcmToken,findAdminFcmToken5[0].fcmToken];
    // var AdminFcmToken2 = findAdminFcmToken2[0].fcmToken;
    // var AdminFcmToken3 = findAdminFcmToken3[0].fcmToken;
    // var AdminFcmToken4 = findAdminFcmToken4[0].fcmToken;
    // var AdminFcmToken5 = findAdminFcmToken5[0].fcmToken;
    
    let dataset = [{
        note: note,
        totaldistance: Math.round(totaldistance.toFixed(2)),
        totaldistamt: Number(distamt),
        extracharges: extracharges,
        extadeliverycharges: Math.ceil(extadeliverycharges.toFixed(2)),
        amount: amt,
        promoused: Math.ceil(promoused.toFixed(2)),
        totalamt: netamount
    },];
    console.log(dataset);

    res.json({ Message: "Calculation Found!", Data: dataset, IsSuccess: true });
});


var round = function (num, precision) {
    num = parseFloat(num);
    if (!precision) return num.toLocaleString();
    return (Math.round(num / precision) * precision).toLocaleString();
};

router.post("/newoder", orderimg.single("orderimg"), async function (
    req,
    res,
    next
) {
    console.log("Neworder api...............................!!!");
    console.log(req.body);
    const {
        customerId,
        deliveryType,
        weightLimit,
        pkName,
        pkMobileNo,
        pkAddress,
        pkLat,
        pkLong,
        pkCompleteAddress,
        pkContent,
        pkArriveType,
        pkArriveTime,
        dpName,
        dpMobileNo,
        dpAddress,
        dpLat,
        dpLong,
        dpCompleteAddress,
        dpDistance,
        collectCash,
        promoCode,
        amount,
        discount,
        additionalAmount,
        finalAmount,
        schedualDateTime,
    } = req.body;
    const file = req.file;
    let num = getOrderNumber();
    try {
        var newOrder = new orderSchema({
            _id: new config.mongoose.Types.ObjectId(),
            orderNo: num,
            customerId: customerId,
            deliveryType: deliveryType,
            schedualDateTime: schedualDateTime,
            weightLimit: weightLimit,
            orderImg: file == undefined ? "" : file.path,
            pickupPoint: {
                name: pkName,
                mobileNo: pkMobileNo,
                address: pkAddress,
                lat: pkLat,
                long: pkLong,
                completeAddress: pkCompleteAddress,
                contents: pkContent,
                arriveType: pkArriveType,
                arriveTime: pkArriveTime,
            },
            deliveryPoint: {
                name: dpName,
                mobileNo: dpMobileNo,
                address: dpAddress,
                lat: dpLat,
                long: dpLong,
                completeAddress: dpCompleteAddress,
                distance: dpDistance,
            },
            collectCash: collectCash,
            promoCode: promoCode,
            amount: amount,
            discount: discount,
            additionalAmount: additionalAmount,
            finalAmount: finalAmount,
            status: "Order Processing",
            note: "Your order is processing!",
        });
        var placedorder = await newOrder.save();
        var avlcourier = await PNDfinder(
            pkLat,
            pkLong,
            placedorder.id,
            placedorder.deliveryType
        );
        
        if (promoCode != "0") {
            let usedpromo = new usedpromoSchema({
                _id: new config.mongoose.Types.ObjectId(),
                customer: customerId,
                code: promoCode,
            });
            usedpromo.save();
        }
        if (placedorder != null && avlcourier.length != 0) {
            console.log("Total Found:" + avlcourier.length);
            let courierfound = arraySort(avlcourier, "distance");
            var newrequest = new requestSchema({
                _id: new config.mongoose.Types.ObjectId(),
                courierId: courierfound[0].courierId,
                orderId: courierfound[0].orderId,
                distance: courierfound[0].distance,
                status: courierfound[0].status,
                reason: courierfound[0].reason,
                fcmToken: courierfound[0].fcmToken,
            });
            await newrequest.save();

    var AdminMobile = await settingsSchema.find({}).select('AdminMObile1 AdminMObile2 AdminMObile3 AdminMObile4 AdminMObile5 -_id');
    console.log("Admin numbers-------------------------------------------------");
    console.log(AdminMobile);
    var AdminNumber1 = AdminMobile[0].AdminMObile1; 
    var AdminNumber2 = AdminMobile[0].AdminMObile2; 
    var AdminNumber3 = AdminMobile[0].AdminMObile3; 
    var AdminNumber4 = AdminMobile[0].AdminMObile4; 
    var AdminNumber5 = AdminMobile[0].AdminMObile5;
    
    console.log(AdminNumber1);

    var findAdminFcmToken = await customerSchema.find({ mobileNo: AdminNumber1 }).select('fcmToken -_id');
    var findAdminFcmToken2 = await customerSchema.find({ mobileNo: AdminNumber2 }).select('fcmToken -_id');
    var findAdminFcmToken3 = await customerSchema.find({ mobileNo: AdminNumber3 }).select('fcmToken -_id');
    var findAdminFcmToken4 = await customerSchema.find({ mobileNo: AdminNumber4 }).select('fcmToken -_id');
    var findAdminFcmToken5 = await customerSchema.find({ mobileNo: AdminNumber5 }).select('fcmToken -_id');
    
    console.log(findAdminFcmToken);
    console.log(findAdminFcmToken2);
    console.log(findAdminFcmToken3);
    console.log(findAdminFcmToken4);
    console.log(findAdminFcmToken5);

    var AdminFcmToken = [findAdminFcmToken[0].fcmToken,findAdminFcmToken2[0].fcmToken,findAdminFcmToken3[0].fcmToken,findAdminFcmToken4[0].fcmToken,findAdminFcmToken5[0].fcmToken];
    console.log("-------------------------ADMINS TOKENS-----------------------------");
    console.log(AdminFcmToken);

    let newOrderData = newOrder.orderNo;
    let newOrderPickUp = newOrder.pickupPoint.address;
    let newOrderDelivery = newOrder.deliveryPoint.address;
    let newOrderCustomerId = newOrder.customerId;
    console.log(newOrderCustomerId);
    let newOrderCustomer = await customerSchema.find({ _id: newOrderCustomerId }).select('name mobileNo -_id');
    
    let newOrderNotification = `New Order Received 
    OrderID: ${newOrderData}
    Customer: ${newOrderCustomer[0].name}
    Mobile: ${newOrderCustomer[0].mobileNo}  
    PickUp: ${newOrderPickUp}`;
    console.log(newOrderNotification);

    // if(AdminNumber1 != null){
    //     sendMessages(AdminNumber1,newOrderNotification);
    // }
    // if(AdminNumber2 != null){
    //     sendMessages(AdminNumber2,newOrderNotification);
    // }
    // if(AdminNumber3 != null){
    //     sendMessages(AdminNumber3,newOrderNotification);
    // }
    // if(AdminNumber4 != null){
    //     sendMessages(AdminNumber4,newOrderNotification);
    // }
    // if(AdminNumber5 != null){
    //     sendMessages(AdminNumber5,newOrderNotification);
    // }
    var AdminPhoneNumbers = [AdminNumber1,AdminNumber2,AdminNumber3,AdminNumber4,AdminNumber5];
            // var payload2 = {
            //     notification: {
            //         title: "Order Alert",
            //         body: "New Order Alert Found For You.",
            //     },
            //     data: {
            //         sound: "surprise.mp3",
            //         Message: "Hello New Order",
            //         click_action: "FLUTTER_NOTIFICATION_CLICK",
            //     },
            // };
            // var options2 = {
            //     priority: "high",
            //     timeToLive: 60 * 60 * 24,
            // };
            // config.firebase
            //     .messaging()
            //     .sendToDevice(AdminFcmToken, payload2, options2)
            //     .then((doc) => {
            //         console.log("Sending Notification Testing3.......!!!");
            //         console.log(doc);
            //     });
            // config.firebase
            // .messaging()
            // .sendToDevice(AdminFcmToken, payload2, options2)
            // .then((doc) => {                    
            //     console.log("Sending Notification Testing2.......!!!");
            //     console.log(doc);
            // });    
            // orderstatus[0]["isActive"] == true &&
            // orderstatus[0]["status"] == "Order Processing"

            //Send notification to Admin FCM
            
            //Sending FCM Notification to Admin
            console.log(AdminFcmToken.length);
        for(let i=0;i<AdminFcmToken.length;i++){
            console.log(`--------------------------------------- ${i}`);
            console.log(AdminFcmToken[i])
            var dataSendToAdmin = {
                "to":AdminFcmToken[i],
                "priority":"high",
                "content_available":true,
                "data": {
                    "sound": "surprise.mp3",
                    "click_action": "FLUTTER_NOTIFICATION_CLICK"
                },
                "notification":{
                            "body": newOrderNotification,
                            "title":"New Order Received",
                            "badge":1
                        }
            };
    
            var options2 = {
                'method': 'POST',
                'url': 'https://fcm.googleapis.com/fcm/send',
                'headers': {
                    'authorization': 'key=AAAAb8BaOXA:APA91bGPf4oQWUscZcjXnuyIJhEQ_bcb6pifUozs9mjrEyNWJcyut7zudpYLBtXGGDU4uopV8dnIjCOyapZToJ1QxPZVBDBSbhP_wxhriQ7kFBlHN1_HVTRtClUla0XSKGVreSgsbgjH',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataSendToAdmin)
            };
            request(options2, function (error, response , body) {
                console.log("--------------------Sender--------------------");
                let myJsonBody = JSON.stringify(body);
                //console.log(myJsonBody);
                //myJsonBody[51] USED TO ACCESS RESPONSE DATA SUCCESS FIELD
                console.log(myJsonBody[51]);
                if(myJsonBody[51]==0){
                    console.log("Send Text notification of new order..........!!!");
                    sendMessages(AdminPhoneNumbers[i],newOrderNotification);
                }
                if (error) {
                    console.log(error.message);
                } else {
                    console.log("Sending Notification Testing....!!!");
                    console.log(response.body);
                    if(response.body.success=="1"){
                        console.log("Send Text notification of new order..........!!!");
                        sendMessages(AdminPhoneNumbers[i],newOrderNotification);
                    }
                }
            });
        }

    console.log("After sending notification");
    
    // FCM notification End

            // New Code 03-09-2020
            var payload = {
                "title": "Order Alert",
                "body": "New Order Alert Found For You.",
                "data": {
                    "sound": "surprise.mp3",
                    "orderid": courierfound[0].orderId.toString(),
                    "distance": courierfound[0].distance.toString(),
                    "click_action": "FLUTTER_NOTIFICATION_CLICK"
                },
                "to": courierfound[0].fcmToken
            };
            var options = {
                'method': 'POST',
                'url': 'https://fcm.googleapis.com/fcm/send',
                'headers': {
                    'authorization': 'key=AAAAb8BaOXA:APA91bGPf4oQWUscZcjXnuyIJhEQ_bcb6pifUozs9mjrEyNWJcyut7zudpYLBtXGGDU4uopV8dnIjCOyapZToJ1QxPZVBDBSbhP_wxhriQ7kFBlHN1_HVTRtClUla0XSKGVreSgsbgjH',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            };
            request(options, function (error, response) {
                if (error) {
                    console.log(error.message);
                } else {
                    console.log("Sending Notification");
                    console.log(response.body);
                }
            });

        } else {
            console.log("No Courier Boys Available:: Waiting For Admin Response");
            var updateorder = {
                status: "Admin",
            };
            await orderSchema.findByIdAndUpdate(placedorder.id, updateorder);
        }
        res
            .status(200)
            .json({ Message: "Order Placed!", Data: 1, IsSuccess: true });
    } catch (err) {
        console.log(err);
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

async function sendMessages(mobileNo, message) {
    let msgportal = "http://websms.mitechsolution.com/api/push.json?apikey=" + process.env.SMS_API + "&route=vtrans&sender=PNDDEL&mobileno=" + mobileNo + "&text= " + message;
    console.log(msgportal);
    axios.get(msgportal);
    var data = await axios.get(msgportal);
    return data;
}
//MultiOrder Number ---04-11-2020

function getMultiOrderNumber() {
    let orderNo = "ORDMT-" + Math.floor(Math.random() * 90000) + 10000;
    return orderNo;
}
//Multiorder API 04-11-2020
router.post("/multiNewOrder", async function(req,res,next){
    var {
        customerId,
        deliveryType,
        weightLimit,
        pkName,
        pkMobileNo,
        pkAddress,
        pkLat,
        pkLong,
        pkCompleteAddress,
        pkContent,
        pkArriveType,
        pkArriveTime,
        deliveryAddresses,
        collectCash,
        promoCode,
        amount,
        discount,
        additionalAmount,
        finalAmount,
        schedualDateTime,
    } = req.body;
    let num = getOrderNumber();
    let numMulti = getMultiOrderNumber();
    var MultiOrders = [];
    for(let i=0;i<deliveryAddresses.length;i++){
        let d1 = deliveryAddresses[i];
        console.log("---------------------")
        console.log(d1);
        try {
            var newMultiOrder = new demoOrderSchema({
                _id: new config.mongoose.Types.ObjectId(),
                orderNo: num,
                customerId: customerId,
                deliveryType: deliveryType,
                schedualDateTime: schedualDateTime,
                weightLimit: weightLimit,
               // orderImg: file == undefined ? "" : file.path,
                pickupPoint: {
                    name: pkName,
                    mobileNo: pkMobileNo,
                    address: pkAddress,
                    lat: pkLat,
                    long: pkLong,
                    completeAddress: pkCompleteAddress,
                    contents: pkContent,
                    arriveType: pkArriveType,
                    arriveTime: pkArriveTime,
                },
                deliveryPoint:{
                    name: deliveryAddresses[i].name,
                },
                collectCash: collectCash,
                promoCode: promoCode,
                amount: amount,
                discount: discount,
                additionalAmount: additionalAmount,
                finalAmount: finalAmount,
                status: "Order Processing",
                note: "Your order is processing!",
            });
            var placeMultiOrder = await newMultiOrder.save();
            MultiOrders.push(placeMultiOrder);
        }catch(err) {
            res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
        }
    } 
    res.status(200).json({ IsSuccess:true , Data: MultiOrders , Message: "Multiorder Added" });
});

//Orderplaced for testing and storing transaction id
// router.post("/newoder_2", orderimg.single("orderimg"), async function (
//     req,
//     res,
//     next
// ) {
//     console.log(req.body);
//     const {
//         customerId,
//         deliveryType,
//         weightLimit,
//         pkName,
//         pkMobileNo,
//         pkAddress,
//         pkLat,
//         pkLong,
//         pkCompleteAddress,
//         pkContent,
//         pkArriveType,
//         pkArriveTime,
//         dpName,
//         dpMobileNo,
//         dpAddress,
//         dpLat,
//         dpLong,
//         dpCompleteAddress,
//         dpDistance,
//         collectCash,
//         promoCode,
//         amount,
//         discount,
//         additionalAmount,
//         finalAmount,
//         schedualDateTime,
//     } = req.body;
//     const file = req.file;
//     const TransactionId  = req.TransactionId;
//     let num = getOrderNumber();
//     try {
//         var newOrder = new orderSchema({
//             _id: new config.mongoose.Types.ObjectId(),
//             orderNo: num,
//             customerId: customerId,
//             deliveryType: deliveryType,
//             schedualDateTime: schedualDateTime,
//             weightLimit: weightLimit,
//             orderImg: file == undefined ? "" : file.path,
//             TransactionId: TransactionId == undefined ? "" : req.TransactionId,
//             pickupPoint: {
//                 name: pkName,
//                 mobileNo: pkMobileNo,
//                 address: pkAddress,
//                 lat: pkLat,
//                 long: pkLong,
//                 completeAddress: pkCompleteAddress,
//                 contents: pkContent,
//                 arriveType: pkArriveType,
//                 arriveTime: pkArriveTime,
//             },
//             deliveryPoint: {
//                 name: dpName,
//                 mobileNo: dpMobileNo,
//                 address: dpAddress,
//                 lat: dpLat,
//                 long: dpLong,
//                 completeAddress: dpCompleteAddress,
//                 distance: dpDistance,
//             },
//             collectCash: collectCash,
//             promoCode: promoCode,
//             amount: amount,
//             discount: discount,
//             additionalAmount: additionalAmount,
//             finalAmount: finalAmount,
//             status: "Order Processing",
//             note: "Your order is processing!",
//         });
//         var placedorder = await newOrder.save();
//         var avlcourier = await PNDfinder(
//             pkLat,
//             pkLong,
//             placedorder.id,
//             placedorder.deliveryType
//         );
//         if (promoCode != "0") {
//             let usedpromo = new usedpromoSchema({
//                 _id: new config.mongoose.Types.ObjectId(),
//                 customer: customerId,
//                 code: promoCode,
//             });
//             usedpromo.save();
//         }
//         if (placedorder != null && avlcourier.length != 0) {
//             console.log("Total Found:" + avlcourier.length);
//             let courierfound = arraySort(avlcourier, "distance");
//             var newrequest = new requestSchema({
//                 _id: new config.mongoose.Types.ObjectId(),
//                 courierId: courierfound[0].courierId,
//                 orderId: courierfound[0].orderId,
//                 distance: courierfound[0].distance,
//                 status: courierfound[0].status,
//                 reason: courierfound[0].reason,
//                 fcmToken: courierfound[0].fcmToken,
//             });
//             await newrequest.save();
//             // var payload = {
//             //     notification: {
//             //         title: "Order Alert",
//             //         body: "New Order Alert Found For You.",
//             //     },
//             //     data: {
//             //         sound: "surprise.mp3",
//             //         orderid: courierfound[0].orderId.toString(),
//             //         distance: courierfound[0].distance.toString(),
//             //         click_action: "FLUTTER_NOTIFICATION_CLICK",
//             //     },
//             // };
//             // var options = {
//             //     priority: "high",
//             //     timeToLive: 60 * 60 * 24,
//             // };
//             // config.firebase
//             //     .messaging()
//             //     .sendToDevice(courierfound[0].fcmToken, payload, options)
//             //     .then((doc) => {
//             //         console.log("Sending Notification");
//             //         console.log(doc);
//             //     });
//             // config.firebase
//             // .messaging()
//             // .sendToDevice(courierfound[0].fcmToken, payload, options)
//             // .then((doc) => {                    
//             //     console.log("Sending Notification");
//             //     console.log(doc);
//             // // });    
//             // orderstatus[0]["isActive"] == true &&
//             // orderstatus[0]["status"] == "Order Processing"

//             // New Code 03-09-2020
//             var payload = {
//                 "title": "Order Alert",
//                 "body": "New Order Alert Found For You.",
//                 "data": {
//                     "sound": "surprise.mp3",
//                     "orderid": courierfound[0].orderId.toString(),
//                     "distance": courierfound[0].distance.toString(),
//                     "click_action": "FLUTTER_NOTIFICATION_CLICK"
//                 },
//                 "to": courierfound[0].fcmToken
//             };
//             var options = {
//                 'method': 'POST',
//                 'url': 'https://fcm.googleapis.com/fcm/send',
//                 'headers': {
//                     'authorization': 'key=AAAAb8BaOXA:APA91bGPf4oQWUscZcjXnuyIJhEQ_bcb6pifUozs9mjrEyNWJcyut7zudpYLBtXGGDU4uopV8dnIjCOyapZToJ1QxPZVBDBSbhP_wxhriQ7kFBlHN1_HVTRtClUla0XSKGVreSgsbgjH',
//                     'Content-Type': 'application/json'
//                 },
//                 body: JSON.stringify(payload)
//             };
//             request(options, function (error, response) {
//                 if (error) {
//                     console.log(error.message);
//                 } else {
//                     console.log("Sending Notification");
//                     console.log(response.body);
//                 }
//             });

//         } else {
//             console.log("No Courier Boys Available:: Waiting For Admin Response");
//             var updateorder = {
//                 status: "Admin",
//             };
//             await orderSchema.findByIdAndUpdate(placedorder.id, updateorder);
//         }
//         res
//             .status(200)
//             .json({ Message: "Order Placed!", Data: 1, IsSuccess: true });
//     } catch (err) {
//         console.log(err);
//         res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
//     }
// });
//End of testing transaction id

router.post("/activeOrders", async function (req, res, next) {
    const { customerId } = req.body;
    try {
        orderSchema
            .find({ customerId: customerId, isActive: true })
            .populate(
                "courierId",
                "firstName lastName fcmToken mobileNo accStatus transport isVerified profileImg"
            )
            .exec()
            .then((docs) => {
                if (docs.length != 0) {
                    res
                        .status(200)
                        .json({ Message: "Order Found!", Data: docs, IsSuccess: true });
                } else {
                    res
                        .status(200)
                        .json({ Message: "No Order Found!", Data: docs, IsSuccess: true });
                }
            });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/completeOrders", async function (req, res, next) {
    const { customerId } = req.body;
    try {
        orderSchema
            .find({ customerId: customerId, isActive: false })
            .populate(
                "courierId",
                "firstName lastName fcmToken mobileNo accStatus transport isVerified profileImg"
            )
            .exec()
            .then((docs) => {
                if (docs.length != 0) {
                    res
                        .status(200)
                        .json({ Message: "Order Found!", Data: docs, IsSuccess: true });
                } else {
                    res
                        .status(200)
                        .json({ Message: "No Order Found!", Data: docs, IsSuccess: true });
                }
            });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//partner app APIs
router.post("/acceptOrder", async function (req, res, next) {
    const { courierId, orderId } = req.body;
    try {
        let orderData = await orderSchema
            .find({ _id: orderId })
            .populate("customerId");
        let courierData = await courierSchema.find({ _id: courierId });
        let request = await requestSchema.find({
            orderId: orderId,
            status: "Accept",
        });

        if (request.length == 0) {
            let getlocation = await currentLocation(courierId);
            if (getlocation.duty == "ON") {
                let updaterequest = await requestSchema.findOneAndUpdate({ orderId: orderId, courierId: courierId }, { status: "Accept" }, { new: true });
                await orderSchema.findByIdAndUpdate(orderId, {
                    courierId: courierId,
                    status: "Order Assigned",
                    note: "Order Has Been Assigned",
                });
                //send Message to customer
                let createMsg =
                    "Your order " +
                    orderData[0].orderNo +
                    " has been accepted by our delivery boy " +
                    courierData[0].firstName +
                    " " +
                    courierData[0].lastName +
                    "--" +
                    courierData[0].mobileNo +
                    ".He Will Reach To You Shortly.";
                sendMessages(orderData[0].customerId.mobileNo, createMsg);
                console.log("---Order Accepted--");
                res
                    .status(200)
                    .json({ Message: "Order Accepted!", Data: 1, IsSuccess: true });
            } else {
                console.log("---Please Turn On Your Duty--");
                res.status(200).json({
                    Message: "Please turn on your duty!",
                    Data: 0,
                    IsSuccess: true,
                });
            }
        } else {
            console.log("---Order Might Be Cancelled By Customer--");
            res.status(200).json({
                Message: "Sorry! Order Not Available",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/takeThisOrder", async function (req, res, next) {
    const { courierId, orderId } = req.body;
    try {
        let courierData = await courierSchema.find({ _id: courierId });
        let orderData = await orderSchema
            .find({ _id: orderId })
            .populate("customerId");
        let getlocation = await currentLocation(courierId);
        if (getlocation.duty == "ON") {
            let updateorder = await requestSchema.findOneAndUpdate({ courierId: courierId, orderId: orderId }, { status: "Takethisorder" });
            if (updateorder != null) {
                let extrakm = new ExtatimeSchema({
                    _id: new config.mongoose.Types.ObjectId(),
                    courierId: courierId,
                    orderId: orderId,
                    blat: getlocation.latitude,
                    blong: getlocation.longitude,
                });
                extrakm.save();
                console.log("---Order Taking Success--");
                res.status(200).json({
                    Message: "Order Taking Successfully!",
                    Data: 1,
                    IsSuccess: true,
                });
            } else {
                console.log("---Order Taking Failed--");
                res
                    .status(200)
                    .json({ Message: "Order Taking Failed!", Data: 0, IsSuccess: true });
            }
        } else {
            console.log("---Please Turn On Your Duty--");
            res.status(200).json({
                Message: "Please turn on your duty!",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/rejectOrder", async function (req, res, next) {
    const { courierId, orderId, reason } = req.body;
    console.log("Data for Reject Order");
    console.log(req.body);
    try {
        var orderData = await orderSchema.find({ _id: orderId, isActive: true });
        orderData.status = "Order Cancel By Employee";
        console.log(orderData);
        let courierData = await courierSchema.find({ _id: courierId });
        if (orderData.length != 0) {
            let getlocation = await currentLocation(courierId);
            if (getlocation.duty == "ON") {
                let updateRejection = await requestSchema.findOneAndUpdate({ courierId: courierId, orderId: orderId }, { status: "Reject", reason: reason });
                let orderRejectInOrder = await orderSchema.insertOne(orderData);
                console.log("Order cancel by Employeee..........................!!!");
                console.log(orderRejectInOrder);
                if (updateRejection != null) {
                    var avlcourier = await PNDfinder(
                        orderData[0].pickupPoint.lat,
                        orderData[0].pickupPoint.long,
                        orderId,
                        orderData[0].deliveryType
                    );

                    if (avlcourier.length != 0) {
                        let nearby = arraySort(avlcourier, "distance");
                        let newrequest = new requestSchema({
                            _id: new config.mongoose.Types.ObjectId(),
                            courierId: nearby[0].courierId,
                            orderId: nearby[0].orderId,
                            distance: nearby[0].distance,
                            status: nearby[0].status,
                            reason: nearby[0].reason,
                            fcmToken: nearby[0].fcmToken,
                        });
                        await newrequest.save();

                        var payload = {
                            notification: {
                                title: "Order Alert",
                                body: "New Order Alert Found For You.",
                            },
                            data: {
                                orderid: orderId.toString(),
                                distance: nearby[0].distance.toString(),
                                click_action: "FLUTTER_NOTIFICATION_CLICK",
                            },
                        };
                        var options = {
                            priority: "high",
                            timeToLive: 60 * 60 * 24,
                        };
                        config.firebase
                            .messaging()
                            .sendToDevice(nearby[0].fcmToken, payload, options)
                            .then((doc) => {
                                console.log("Sending Notification");
                                console.log(doc);
                            });

                        //add Logger
                        let logger = new locationLoggerSchema({
                            _id: new config.mongoose.Types.ObjectId(),
                            courierId: courierId,
                            lat: getlocation.latitude,
                            long: getlocation.longitude,
                            description: courierData[0].cId +
                                " has rejected order " +
                                orderData[0].orderNo,
                        });
                        logger.save();

                        res.status(200).json({
                            Message: "Order Has Been Rejected!",
                            Data: 1,
                            IsSuccess: true,
                        });
                    } else {
                        console.log("All Courier Boys Are Busy");
                        var updateorder = {
                            note: "Order is Processing",
                            status: "Admin",
                        };
                        await orderSchema.findByIdAndUpdate(orderId, updateorder);
                        console.log("---Order Rejected--");
                        res.status(200).json({
                            Message: "Order Has Been Rejected!",
                            Data: 1,
                            IsSuccess: true,
                        });
                    }
                } else {
                    console.log("---Unable to Reject Order--");
                    res.status(200).json({
                        Message: "Unable to Reject Order!",
                        Data: 0,
                        IsSuccess: true,
                    });
                }
            } else {
                console.log("---Please Turn On Your Duty--");
                res.status(200).json({
                    Message: "Please turn on your duty!",
                    Data: 0,
                    IsSuccess: true,
                });
            }
        } else {
            console.log("---Order Might Be Cancelled By Customer--");
            res.status(200).json({
                Message: "Sorry! Order Not Available",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/noResponseOrder", async function (req, res, next) {
    const { courierId, orderId } = req.body;
    try {
        var updateRejection = await requestSchema.findOneAndUpdate({ courierId: courierId, orderId: orderId }, { status: "NoResponse", reason: "Not Responded By Delivery Boy" });
        if (updateRejection != null) {
            var orderData = await orderSchema.find({ _id: orderId, isActive: true });
            if (orderData.length != 0) {
                var avlcourier = await PNDfinder(
                    orderData[0].pickupPoint.lat,
                    orderData[0].pickupPoint.long,
                    orderId,
                    orderData[0].deliveryType
                );
                if (avlcourier.length != 0) {
                    console.log("Courier Boys Available");
                    let courierfound = arraySort(avlcourier, "distance");
                    let newrequest = new requestSchema({
                        _id: new config.mongoose.Types.ObjectId(),
                        courierId: courierfound[0].courierId,
                        orderId: courierfound[0].orderId,
                        distance: courierfound[0].distance,
                        status: courierfound[0].status,
                        reason: courierfound[0].reason,
                        fcmToken: courierfound[0].fcmToken,
                    });
                    await newrequest.save();
                    var payload = {
                        notification: {
                            title: "Order Alert",
                            body: "New Order Alert Found For You.",
                        },
                        data: {
                            orderid: courierfound[0].orderId.toString(),
                            distance: courierfound[0].distance.toString(),
                            click_action: "FLUTTER_NOTIFICATION_CLICK",
                        },
                    };
                    var options = {
                        priority: "high",
                        timeToLive: 60 * 60 * 24,
                    };
                    config.firebase
                        .messaging()
                        .sendToDevice(courierfound[0].fcmToken, payload, options)
                        .then((doc) => {
                            console.log("Sending Notification");
                            console.log(doc);
                        });
                    res
                        .status(200)
                        .json({ Message: "Order No Response!", Data: 1, IsSuccess: true });
                } else {
                    console.log("No Courier Boys Available:: Waiting For Admin Response");
                    var updateorder = {
                        note: "Order is Processing.",
                        status: "Admin",
                    };
                    await orderSchema.findByIdAndUpdate(orderId, updateorder);
                    res.status(200).json({
                        Message: "Order Sent To Admin!",
                        Data: 1,
                        IsSuccess: true,
                    });
                }
            }
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/reachPickPoint", async function (req, res, next) {
    const { courierId, orderId } = req.body;
    try {
        var location = await currentLocation(courierId);
        if (location.duty == "ON") {
            var checkif = await orderSchema
                .find({ _id: orderId, isActive: true })
                .populate("customerId");

            if (checkif.length != 0) {
                await orderSchema.findOneAndUpdate({ _id: orderId, courierId: courierId }, {
                    status: "Order Picked",
                    note: "Delivery boy reached to pickup point",
                });

                var data = { plat: location.latitude, plong: location.longitude };
                await ExtatimeSchema.findOneAndUpdate({ courierId: courierId, orderId: orderId },
                    data
                );

                // sendMessages(
                //     checkif[0].pickupPoint.mobileNo,
                //     "Your delivery boy reached To pickup Point."
                // );

                // sendMessages(
                //     checkif[0].deliveryPoint.mobileNo,
                //     "Your delivery boy reached To pickup point. He will reach to you shortly."
                // );

                res
                    .status(200)
                    .json({ Message: "Reached Pickup Point!", Data: 1, IsSuccess: true });
            } else {
                res
                    .status(200)
                    .json({ Message: "Order Not Available!", Data: 0, IsSuccess: true });
            }
        } else {
            res.status(200).json({
                Message: "Please Turn ON Your Duty!",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/reachDropPoint", async function (req, res, next) {
    const { courierId, orderId } = req.body;
    try {

        // Check If Given Order Is Active or Not
        var checkif = await orderSchema
            .find({ _id: orderId, isActive: true })
            .populate("customerId");
        if (checkif.length != 0) {

            // Order Schema updated With Status Order Delivered
            await orderSchema.findOneAndUpdate({ _id: orderId, courierId: courierId }, { status: "Order Delivered", note: "Order Delivered", isActive: false });

            // Set Delivery Date In Extratime Schema
            let newDate = new Date();
            await ExtatimeSchema.findOneAndUpdate({ orderId: orderId, courierId: courierId }, { deliverytime: newDate });

            // Sending Message To Sender
            sendMessages(
                checkif[0].customerId.mobileNo,
                "Your Order Has Been Delivered."
            );

            // Sending Message To Reciever
            sendMessages(
                checkif[0].deliveryPoint.mobileNo,
                "Your Order Has Been Delivered."
            );

            res
                .status(200)
                .json({ Message: "Order Delivered!", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Order Not Available!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/c_activeOrder", async function (req, res, next) {
    const { courierId } = req.body;
    var data = await requestSchema.find({
        courierId: courierId,
        status: "Takethisorder",
    });
    var datalist = [];
    if (data.length != 0) {
        for (var i = 0; i < data.length; i++) {
            var orderdata = await orderSchema.findOne({
                _id: data[i].orderId,
                courierId: courierId,
                isActive: true,
            });
            if (orderdata != null) datalist.push(orderdata);
        }
        console.log(datalist);
        if (datalist.length != 0) {
            res
                .status(200)
                .json({ Message: "Orders Found!", Data: datalist, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "No Orders Found!", Data: datalist, IsSuccess: true });
        }
    } else {
        let orderdata = [];
        res
            .status(200)
            .json({ Message: "No Orders Found!", Data: orderdata, IsSuccess: true });
    }
});

router.post("/c_completeOrder", async function (req, res, next) {
    const { courierId } = req.body;
    var data = await orderSchema.find({ courierId: courierId, isActive: false });
    if (data.length != 0) {
        res
            .status(200)
            .json({ Message: "Orders Found!", Data: data, IsSuccess: true });
    } else {
        res
            .status(200)
            .json({ Message: "No Orders Found!", Data: data, IsSuccess: true });
    }
});

router.post("/c_responseOrder", async function (req, res, next) {
    const { courierId } = req.body;
    var data = await requestSchema.find({
        courierId: courierId,
        status: "Accept",
    });
    var datalist = [];
    if (data.length != 0) {
        for (var i = 0; i < data.length; i++) {
            var orderdata = await orderSchema.findOne({
                _id: data[i].orderId,
                courierId: courierId,
                isActive: true,
            });
            if (orderdata != null) {
                datalist.push(orderdata);
            }
        }
        console.log(datalist);
        if (datalist.length != 0) {
            res
                .status(200)
                .json({ Message: "Orders Found!", Data: datalist, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "No Orders Found!", Data: datalist, IsSuccess: true });
        }
    } else {
        let orderdata = [];
        res
            .status(200)
            .json({ Message: "No Orders Found!", Data: orderdata, IsSuccess: true });
    }
});

router.post("/orderDetails", async function (req, res, next) {
    const { id } = req.body;
    try {
        var order = await orderSchema.find({ _id: id });
        if (order.length == 1) {
            res
                .status(200)
                .json({ Message: "Orders Found!", Data: order, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Orders Not Found!", Data: order, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/orderStatus", async function (req, res, next) {
    const { id } = req.body;
    try {
        var order = await orderSchema.find({ _id: id }).select("isActive status");
        if (order.length == 1) {
            res
                .status(200)
                .json({ Message: "Orders Found!", Data: order, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Orders Not Found!", Data: order, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/orderCancelByCustomer", async function(req , res ,next){
    const { id , customerId } = req.body;
    var TimeHours = "";
    var TimeMinutes = "";
    var TimeSeconds = "";
    var TimeYear = "";
    var TimeMonth = "";
    var TimeDate = "";

    try {
        let customerOrder = await orderSchema.find({ $and: [ { _id: id }, { customerId: customerId } ] });
        console.log(customerOrder);
        if(customerOrder.length == 1){
            let orderNo = customerOrder[0].orderNo;
            let OrderTime = customerOrder[0].schedualDateTime;
            console.log(OrderTime);

            var getextractData = await orderSchema.aggregate(
                [
                    {$match:
                        {'orderNo': orderNo}
                    },
                  {
                    $project:
                      {
                        year: { $year: "$schedualDateTime" },
                        month: { $month: "$schedualDateTime" },
                        day: { $dayOfMonth: "$schedualDateTime" },
                        hour: { $hour: "$schedualDateTime" },
                        minutes: { $minute: "$schedualDateTime" },
                        seconds: { $second: "$schedualDateTime" },
                        milliseconds: { $millisecond: "$schedualDateTime" },
                        dayOfYear: { $dayOfYear: "$schedualDateTime" },
                        dayOfWeek: { $dayOfWeek: "$schedualDateTime" },
                        week: { $week: "$schedualDateTime" }
                      }
                  }
                ]
             ).then(dataList => {
                var timeData = dataList;
                TimeHours = timeData[0].hour;
                TimeMinutes = timeData[0].minutes;
                TimeSeconds = timeData[0].seconds;
                TimeYear = timeData[0].year;
                TimeMonth = timeData[0].month;
                TimeDate = timeData[0].day;

                console.log(timeData[0].year);
                console.log(timeData);
                
             });
             console.log(`Year : ${TimeHours}`);
             console.log(`Minutes : ${TimeMinutes}`);
             console.log(`Seconds : ${TimeSeconds}`);
             console.log(`Year : ${TimeYear}`);
             console.log(`Month : ${TimeMonth}`);
             console.log(`Day : ${TimeDate}`);
             //console.log(`Seconds : ${TimeSeconds}`);
            let myNewDate = new Date(TimeYear,TimeMonth,TimeDate,TimeHours,TimeMinutes,TimeSeconds);
            console.log(myNewDate.getMinutes());
            myNewDate.setMinutes(myNewDate.getMinutes() - 15);
            console.log(myNewDate);

            var hh = myNewDate.getHours();
            var mm = myNewDate.getMinutes();
            var ss = myNewDate.getSeconds();
            
            res.status(200).json({ 
                        IsSuccess : true , 
                        Message : "Order Cancel Limit!!!" ,
                        OrderCancelLimit : myNewDate,
                        ReadableFormat : [hh, mm, ss].join(':') });
        }else{
            res.status(400).json({ IsSuccess : false , Message : "Not Found...!!!" , Data : 0 });
        }
    } catch (error) {
        res.status(500).json({ IsSuccess : false , Message : error.message});
    }
});

router.post("/cancelOrder" , async function(req,res,next){
    const { id } = req.body;
    try {
        var orderWant = await orderSchema.findByIdAndUpdate({ _id: id },{ status : "Order Cancelled" });
        if (orderWant.length == 1) {
            res
                .status(200)
                .json({ Message: "Orders Cancel!", Data: orderWant, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Orders Not Found!", Data: orderWant, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});
module.exports = router;