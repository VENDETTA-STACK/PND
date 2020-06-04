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
const { getDistance, convertDistance } = require("geolib");

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

//CUSTOMER APP API
router.post("/settings", async function(req, res, next) {
    const customerId = req.body.customerId;
    try {
        var getsettings = await settingsSchema.find({});
        if (getsettings.length == 1) {
            // let orders = await orderSchema.find({customerId:customerId});
            // if(orders.length != 0){
            //   res.status(200).json({
            //     Message: "Settings Found!",
            //     Data: getsettings,
            //     IsSuccess: true,
            //   });
            // }else{
            //   let dataset = [{
            //     _id:getsettings[0]._id,
            //     PerUnder5KM:0,
            //     PerKM:0,
            //     ExpDelivery:0,
            //     ReferalPoint:getsettings[0].ReferalPoint,
            //     WhatsAppNo:getsettings[0].WhatsAppNo,
            //     AppLink:getsettings[0].AppLink,
            //     DefaultWMessage:getsettings[0].DefaultWMessage
            //   }];
            // }
            res.status(200).json({
                Message: "Settings Found!",
                Data: getsettings,
                IsSuccess: true,
            });
        } else {
            res.status(200).json({
                Message: "Settings Not Found!",
                Data: getsettings,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/newoder", async function(req, res, next) {
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
    let num = getOrderNumber();
    try {
        var newOrder = new orderSchema({
            _id: new config.mongoose.Types.ObjectId(),
            orderNo: num,
            customerId: customerId,
            deliveryType: deliveryType,
            weightLimit: weightLimit,
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
            status: pkArriveType == "rightnow" ? "Finding" : "Scheduled",
            note: pkArriveType == "rightnow" ?
                "Your order is processing!" : "Your Order is Scheduled",
        });

        var placedorder = await newOrder.save();
        var avlcourier = await findCourierBoy(pkLat, pkLong, placedorder.id);

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

async function findCourierBoy(pick_lat, pick_long, orderid) {
    var listCouriers = [];
    var getCourier = await courierSchema
        .find({ isActive: true, isVerified: true, "accStatus.flag": true })
        .select("id fcmToken");
    for (let i = 0; i < getCourier.length; i++) {
        let location = await currentLocation(getCourier[i].id);
        if (location != null && location.duty == "ON" && Number(location.parcel) < 3) {
            let counter = await requestSchema.countDocuments({ orderId: orderid });
            let exist = await requestSchema.find({
                courierId: getCourier[i].id,
                orderId: orderid,
            });
            if (counter <= 3) {
                if (exist.length == 0) {
                    let courierLocation = {
                        latitude: location.latitude,
                        longitude: location.longitude,
                    };
                    let pickLocation = { latitude: pick_lat, longitude: pick_long };
                    let distanceKM = convertDistance(
                        getDistance(courierLocation, pickLocation, 1000),
                        "km"
                    );
                    if (distanceKM <= 15) {
                        listCouriers.push({
                            courierId: getCourier[i].id,
                            orderId: orderid,
                            distance: distanceKM,
                            status: "Pending",
                            fcmToken: getCourier[i].fcmToken,
                            reason: "",
                        });
                    }
                }
            }
        }
    }
    return listCouriers;
}

router.post("/activeOrders", async function(req, res, next) {
    const { customerId } = req.body;
    try {
        orderSchema
            .find({ customerId: customerId, isActive: true })
            .populate(
                "courierId",
                "firstName lastName fcmToken mobileNo accStatus transport isVerified"
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
                "firstName lastName fcmToken mobileNo accStatus transport isVerified"
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

router.post("/promoCodes", async function(req, res, next) {
    const { customerId } = req.body;
    try {
        var datasets = [];
        let listPromoCodes = await promoCodeSchema.find({ isActive: true });
        for (var i = 0; i < listPromoCodes.length; i++) {
            let exist = await usedpromoSchema.find({
                customer: customerId,
                code: listPromoCodes[i].code,
            });
            if (exist.length == 0) datasets.push(listPromoCodes[i]);
        }
        if (datasets.length != 0) {
            res.status(200).json({
                Message: "Promocodes Found!",
                Data: datasets,
                IsSuccess: true,
            });
        } else {
            res.status(200).json({
                Message: "No Promocodes Found!",
                Data: datasets,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/applyPromoCode", async function(req, res, next) {
    const { customerId, code } = req.body;
    try {
        let listPromoCodes = await promoCodeSchema.find({
            isActive: true,
            code: code,
        });
        if (listPromoCodes.length === 1) {
            let exist = await usedpromoSchema.find({
                customer: customerId,
                code: code,
            });
            if (exist.length === 0) {
                res.status(200).json({
                    Message: "Promo Code Found!",
                    Data: listPromoCodes,
                    IsSuccess: true,
                });
            } else {
                res.status(200).json({
                    Message: "Promo Code Already Used!",
                    Data: 0,
                    IsSuccess: true,
                });
            }
        } else {
            res
                .status(200)
                .json({ Message: "Promocode Not Found!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//COURIER BOY APP API
router.post("/acceptOrder", async function(req, res, next) {
    const { courierId, orderId } = req.body;
    try {
        let orderData = await orderSchema.find({ '_id': orderId }).populate('customerId');
        let courierData = await courierSchema.find({ '_id': courierId });
        let request = await requestSchema.find({ orderId: orderId, status: "Accept" });

        if (request.length == 0) {
            let getlocation = await currentLocation(courierId);
            if (getlocation.duty == "ON") {

                let updaterequest = await requestSchema.findOneAndUpdate({ orderId: orderId, courierId: courierId }, { status: "Accept" }, { new: true });
                if (updaterequest.status == "Accept") {
                    await orderSchema.findByIdAndUpdate(orderId, { courierId: courierId, status: "Order Assigned", note: "Order Has Been Assigned" });
                    //send Message to customer
                    let createMsg = "Your order has been accepted by our delivery boy " + courierData[0].firstName + " " + courierData[0].lastName + "--" + courierData[0].mobileNo;
                    sendMessages(orderData[0].customerId.mobileNo, createMsg);

                    //send Notification to customer
                    let data = {
                        click_action: "FLUTTER_NOTIFICATION_CLICK",
                    };
                    let notchecker = await sendPopupNotification(orderData[0].customerId.fcmToken, "Order Accepted", "Your Order Has Been Accepted!", data);
                    console.log("---Order Accepted--");
                    console.log(notchecker);

                    //add Logger
                    let logger = new locationLoggerSchema({
                        _id: new config.mongoose.Types.ObjectId(),
                        courierId: courierId,
                        lat: getlocation.latitude,
                        long: getlocation.longitude,
                        description: courierData[0].cId + " Has Accepted Order " + orderData[0].orderNo,
                    });
                    logger.save();
                    res.status(200).json({ Message: "Order accepted!", Data: 1, IsSuccess: true });
                } else {
                    console.log("---Unable Order Accepted--");
                    res.status(200).json({ Message: "Unable to accepted order!", Data: 0, IsSuccess: true });
                }
            } else {
                console.log("---Please Turn On Your Duty--");
                res.status(200).json({ Message: "Please turn on your duty!", Data: 0, IsSuccess: true });
            }
        } else {
            console.log("---Order Might Be Cancelled By Customer--");
            res.status(200).json({ Message: "Sorry! Order Not Available", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/takeThisOrder", async function(req, res, next) {
    const { courierId, orderId } = req.body;
    try {
        let courierData = await courierSchema.find({ '_id': courierId });
        let orderData = await orderSchema.find({ '_id': orderId }).populate('customerId');
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

                //calculate Time
                let emplocation = { latitude: getlocation.latitude, longitude: getlocation.longitude };
                let picklocation = { latitude: orderData[0].pickupPoint.lat, longitude: orderData[0].pickupPoint.long };
                let distanceKM = convertDistance(getDistance(emplocation, picklocation, 1000), "km");
                let approxtime = (Number(distanceKM) / 40) * 60;
                sendMessages(orderData[0].customerId.mobileNo, "Your delivery boy will reach to pickup point in approx " + approxtime + " min.");

                //add Logger
                let logger = new locationLoggerSchema({
                    _id: new config.mongoose.Types.ObjectId(),
                    courierId: courierId,
                    lat: getlocation.latitude,
                    long: getlocation.longitude,
                    description: courierData[0].cId + " has started order " + orderData[0].orderNo,
                });
                logger.save();
            } else {
                console.log("---Order Taking Failed--");
                res.status(200).json({ Message: "Order Taking Failed!", Data: 0, IsSuccess: true });
            }
        } else {
            console.log("---Please Turn On Your Duty--");
            res.status(200).json({ Message: "Please turn on your duty!", Data: 0, IsSuccess: true });
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
        var orderData = await orderSchema.find({ '_id': orderId, isActive: true, });
        let courierData = await courierSchema.find({ '_id': courierId });
        if (orderData.length != 0) {
            let getlocation = await currentLocation(courierId);
            if (getlocation.duty == "ON") {
                let updateRejection = await requestSchema.findOneAndUpdate({ courierId: courierId, orderId: orderId }, { status: "Reject", reason: reason });
                if (updateRejection != null) {
                    var avlcourier = await findCourierBoy(orderData[0].pickupPoint.lat, orderData[0].pickupPoint.long, orderId);

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
                            description: courierData[0].cId + " has rejected order " + orderData[0].orderNo,
                        });
                        logger.save();

                        res.status(200).json({ Message: "Order Has Been Rejected!", Data: 1, IsSuccess: true });
                    } else {

                        console.log("All Courier Boys Are Busy");
                        var updateorder = {
                            note: "Order is Processing",
                            status: "Admin",
                        };
                        await orderSchema.findByIdAndUpdate(orderId, updateorder);
                        console.log("---Order Rejected--");
                        res.status(200).json({ Message: "Order Has Been Rejected!", Data: 1, IsSuccess: true });
                    }

                } else {
                    console.log("---Unable to Reject Order--");
                    res.status(200).json({ Message: "Unable to Reject Order!", Data: 0, IsSuccess: true });
                }
            } else {
                console.log("---Please Turn On Your Duty--");
                res.status(200).json({ Message: "Please turn on your duty!", Data: 0, IsSuccess: true });
            }
        } else {
            console.log("---Order Might Be Cancelled By Customer--");
            res.status(200).json({ Message: "Sorry! Order Not Available", Data: 0, IsSuccess: true });
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
                var avlcourier = await findCourierBoy(
                    orderData[0].pickupPoint.lat,
                    orderData[0].pickupPoint.long,
                    orderId
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

                    let fcmtoken = courierfound[0].fcmToken;
                    let title = "New Order Alert";
                    let body = "New Order Found For You!";
                    let data = {
                        orderid: courierfound[0].orderId.toString(),
                        distance: courierfound[0].distance.toString(),
                        click_action: "FLUTTER_NOTIFICATION_CLICK",
                    };
                    sendPopupNotification(fcmtoken, title, body, data);
                    res.status(200).json({ Message: "Order No Response!", Data: 1, IsSuccess: true });
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
                await orderSchema.findOneAndUpdate({ _id: orderId, courierId: courierId }, { status: "Order Picked", note: "Delivery boy reached to pickup point" });
                var data = { plat: location.latitude, plong: location.longitude };
                await ExtatimeSchema.findOneAndUpdate({ courierId: courierId, orderId: orderId },
                    data
                );
                sendMessages(
                    checkif[0].customerId.mobileNo,
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
        var checkif = await orderSchema
            .find({ _id: orderId, isActive: true })
            .populate("customerId");
        if (checkif.length != 0) {
            await orderSchema.findOneAndUpdate({ _id: orderId, courierId: courierId }, { status: "Order Delivered", note: "Order Delivered", isActive: false });
            let send = await sendMessages(
                checkif[0].customerId.mobileNo,
                "Your Order Has Been Delivered."
            );
            let ase = await sendMessages(
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

//testing Apis
router.post("/sendOrderNotification", async function(req, res, next) {
    try {
        let orderId = "5ed242aba0e6f600246246a2";
        let fcm = "eAt0t9L-QWyiGx2rCS_VaC:APA91bFUx2w1FPNhGTxJiKZonXrGKRUnKax0jsNwIZU6kssvpiIloCvFsABzfSYgV280ULMjai7WAeCroOUHd-ij8iQV-hSWFn-fQURp8nfzGTK-5AFyKRPbBxqKIdJcA0sebYVX7lIT";
        var orderDatas = await orderSchema.find({ '_id': orderId, isActive: true, });

        let data = {
            orderid: orderId,
            distance: "5",
            click_action: "FLUTTER_NOTIFICATION_CLICK",
        };
        let test = await sendPopupNotification(fcm, "Order Alert!", "New Order Found", data);
        console.log(test);
        res.status(200).json({ Message: "Notification Sent!", Data: 1, IsSuccess: true });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

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

async function sendPopupNotification(fcmtoken, title, body, data) {
    let payload = { notification: { title: title, body: body }, data: data };
    let options = { priority: "high", timeToLive: 60 * 60 * 24 };
    let response = await config.firebase
        .messaging()
        .sendToDevice(fcmtoken, payload, options);
    return response;
}

async function currentLocation(courierId) {
    var CourierRef = config.docref.child(courierId);
    const data = await CourierRef.once("value")
        .then((snapshot) => snapshot.val())
        .catch((err) => err);
    return data;
}

module.exports = router;