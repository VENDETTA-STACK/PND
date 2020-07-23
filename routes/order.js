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
var imguploader = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, "uploads/orderimg");
    },
    filename: function(req, file, cb) {
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
                if (totalrequests <= 3) {
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
                if (totalrequests <= 3) {
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

async function sendMessages(mobileNo, message) {
    let msgportal =
        "http://promosms.itfuturz.com/vendorsms/pushsms.aspx?user=" +
        process.env.SMS_USER +
        "&password=" +
        process.env.SMS_PASS +
        "&msisdn=" +
        mobileNo +
        "&sid=" +
        process.env.SMS_SID +
        "&msg=" +
        message +
        "&fl=0&gwid=2";
    var data = await axios.get(msgportal);
    return data;
}

async function currentLocation(courierId) {
    var CourierRef = config.docref.child(courierId);
    const data = await CourierRef.once("value")
        .then((snapshot) => snapshot.val())
        .catch((err) => err);
    return data;
}

//customers app APIs
router.post("/settings", async function(req, res, next) {
    try {
        let getsettings = await settingsSchema.find({});
        let getdeliverytypes = await deliverytypesSchema.find({});

        let predata = [{
            settings: getsettings,
            deliverytypes: getdeliverytypes,
        }, ];

        res.status(200).json({
            Message: "Settings Found!",
            Data: predata,
            IsSuccess: true,
        });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/ordercalc", async(req, res, next) => {
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
    }, ];

    res.json({ Message: "Calculation Found!", Data: dataset, IsSuccess: true });
});


router.post("/ordercalcV2", async(req, res, next) => {
    const {
        picklat,
        picklong,
        droplat,
        droplong,
        deliverytype,
        promocode,
        parcelcontents
    } = req.body;

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
    let sortParcelContents = arraySort(parcelcontents,'price',{reverse: true});
    let extracharges = 0;
    for(let a=0;a<sortParcelContents.length;a++){
        extracharges = extracharges + sortParcelContents[a].price;
    }
    let amt = Number(distamt) + extracharges + Math.ceil(extadeliverycharges.toFixed(2));
    promoused = prmcodes.length != 0 ? (amt * prmcodes[0].discount) / 100 : 0;
    let netamount = amt - Math.ceil(promoused.toFixed(2));

    let dataset = [{
        totaldistance: Math.round(totaldistance.toFixed(2)),
        totaldistamt: Number(distamt),
        extracharges:extracharges,
        extadeliverycharges: Math.ceil(extadeliverycharges.toFixed(2)),
        amount: amt,
        promoused: Math.ceil(promoused.toFixed(2)),
        totalamt: netamount
    }, ];

    res.json({ Message: "Calculation Found!", Data: dataset, IsSuccess: true });
});


var round = function(num, precision) {
    num = parseFloat(num);
    if (!precision) return num.toLocaleString();
    return (Math.round(num / precision) * precision).toLocaleString();
};

router.post("/newoder", orderimg.single("orderimg"), async function(
    req,
    res,
    next
) {
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
    } = req.body;
    const file = req.file;
    let num = getOrderNumber();
    try {
        var newOrder = new orderSchema({
            _id: new config.mongoose.Types.ObjectId(),
            orderNo: num,
            customerId: customerId,
            deliveryType: deliveryType,
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
            var payload = {
                notification: {
                    title: "Order Alert",
                    body: "New Order Alert Found For You.",
                },
                data: {
                    sound: "surprise.mp3",
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
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/activeOrders", async function(req, res, next) {
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

router.post("/completeOrders", async function(req, res, next) {
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
router.post("/acceptOrder", async function(req, res, next) {
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

router.post("/takeThisOrder", async function(req, res, next) {
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

router.post("/rejectOrder", async function(req, res, next) {
    const { courierId, orderId, reason } = req.body;
    console.log("Data for Reject Order");
    console.log(req.body);
    try {
        var orderData = await orderSchema.find({ _id: orderId, isActive: true });
        let courierData = await courierSchema.find({ _id: courierId });
        if (orderData.length != 0) {
            let getlocation = await currentLocation(courierId);
            if (getlocation.duty == "ON") {
                let updateRejection = await requestSchema.findOneAndUpdate({ courierId: courierId, orderId: orderId }, { status: "Reject", reason: reason });
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

router.post("/noResponseOrder", async function(req, res, next) {
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

router.post("/reachPickPoint", async function(req, res, next) {
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

                sendMessages(
                    checkif[0].pickupPoint.mobileNo,
                    "Your delivery boy reached To pickup Point."
                );

                sendMessages(
                    checkif[0].deliveryPoint.mobileNo,
                    "Your delivery boy reached To pickup point. He will reach to you shortly."
                );

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

router.post("/reachDropPoint", async function(req, res, next) {
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

router.post("/c_activeOrder", async function(req, res, next) {
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

router.post("/c_completeOrder", async function(req, res, next) {
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

router.post("/c_responseOrder", async function(req, res, next) {
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

router.post("/orderDetails", async function(req, res, next) {
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

router.post("/orderStatus", async function(req, res, next) {
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

module.exports = router;