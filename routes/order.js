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
router.post("/settings", async function (req, res, next) {
  try {
    var getsettings = await settingsSchema.find({});
    if (getsettings.length == 1) {
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

router.post("/newoder", async function (req, res, next) {
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
      note:
        pkArriveType == "rightnow"
          ? "Your order is processing!"
          : "Your Order is Scheduled",
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
          type: "orders",
          orderid: courierfound[0].orderId,
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
        note: "All Courier Boys Are Busy. Please wait for response.",
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
    if (
      location != null &&
      location.duty == "ON" &&
      Number(location.parcel) < 3
    ) {
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

router.post("/activeOrders", async function (req, res, next) {
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

router.post("/completeOrders", async function (req, res, next) {
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

router.post("/promoCodes", async function (req, res, next) {
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

router.post("/applyPromoCode", async function (req, res, next) {
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
router.post("/acceptOrder", async function (req, res, next) {
  const { courierId, orderId } = req.body;
  try {
    var checkif = await requestSchema.find({
      orderId: orderId,
      status: "Accept",
    });

    if (checkif.length == 0) {
      var location = await currentLocation(courierId);
      if (location.duty == "ON") {
        let locationfinder = location.latitude + "," + location.longitude;
        let description = orderId + " had Been Accepted";
        let logger = new locationLoggerSchema({
          _id: new config.mongoose.Types.ObjectId(),
          courierId: courierId,
          latlong: locationfinder,
          description: description,
        });

        var data = await requestSchema.findOneAndUpdate(
          { orderId: orderId, courierId: courierId },
          { status: "Accept" },
          { new: true }
        );
        if (data.status == "Accept") {
          console.log(data);
          await orderSchema.findByIdAndUpdate(orderId, {
            courierId: courierId,
            status: "Order Assigned",
            note: "Order Has Been Assigned",
          });
          logger.save();
          res
            .status(200)
            .json({ Message: "Order Accepted!", Data: 1, IsSuccess: true });
        } else {
          res
            .status(200)
            .json({ Message: "Order No Accepted!", Data: 0, IsSuccess: true });
        }
      } else {
        res
          .status(200)
          .json({ Message: "Please Your Duty On!", Data: 0, IsSuccess: true });
      }
    } else {
      res
        .status(200)
        .json({ Message: "Order Not Available!", Data: 0, IsSuccess: true });
    }
  } catch (err) {
    res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
  }
});

router.post("/takeThisOrder", async function (req, res, next) {
  const { courierId, orderId } = req.body;
  try {
    var location = await currentLocation(courierId);
    if (location.duty == "ON") {
      var updatetakeOrder = await requestSchema.findOneAndUpdate(
        { courierId: courierId, orderId: orderId },
        { status: "TakeThisOrder" }
      );
      if (updatetakeOrder != null) {
        var prepare = new ExtatimeSchema({
          _id: new config.mongoose.Types.ObjectId(),
          courierId: courierId,
          orderId: orderId,
          blat: location.latitude,
          blong: location.longitude,
        });
        await prepare.save();
        res
          .status(200)
          .json({ Message: "Order Taking Success!", Data: 1, IsSuccess: true });
      } else {
        res
          .status(200)
          .json({ Message: "Order Taking Failed!", Data: 0, IsSuccess: true });
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

router.post("/rejectOrder", async function (req, res, next) {
  const { courierId, orderId, reason } = req.body;
  try {
    var updateRejection = await requestSchema.findOneAndUpdate(
      { courierId: courierId, orderId: orderId },
      { status: "Reject", reason: reason }
    );
    var location = await currentLocation(courierId);
    if (location.duty == "ON") {
      if (updateRejection != null) {
        var orderData = await orderSchema.find({
          _id: orderId,
          isActive: true,
        });
        if (orderData.length != 0) {
          var avlcourier = await findCourierBoy(
            orderData[0].pickupPoint.lat,
            orderData[0].pickupPoint.long,
            orderId
          );
          if (avlcourier.length != 0) {
            console.log("Total Found: " + avlcourier.length);
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
                type: "orders",
                orderid: courierfound[0].orderId,
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
              .json({ Message: "Order Rejected!", Data: 1, IsSuccess: true });
          } else {
            console.log(
              "No Courier Boys Available:: Waiting For Admin Response"
            );
            var updateorder = {
              note: "All Courier Boys Are Busy. Please wait for response.",
              status: "Admin",
            };
            await orderSchema.findByIdAndUpdate(placedorder.id, updateorder);

            res
              .status(200)
              .json({ Message: "Order Rejected!", Data: 1, IsSuccess: true });
          }
        } else {
          res
            .status(200)
            .json({ Message: "Order Not Found!", Data: 0, IsSuccess: true });
        }
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

router.post("/noResponseOrder", async function (req, res, next) {
  const { courierId, orderId } = req.body;
  try {
    var updateRejection = await requestSchema.findOneAndUpdate(
      { courierId: courierId, orderId: orderId },
      { status: "NoResponse", reason: "Not Responded By Delivery Boy" }
    );
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
            type: "orders",
            orderid: courierfound[0].orderId,
            distance: courierfound[0].distance.toString(),
            click_action: "FLUTTER_NOTIFICATION_CLICK",
          };
          sendPopupNotification(fcmtoken, title, body, data);
          res
            .status(200)
            .json({ Message: "Order No Response!", Data: 1, IsSuccess: true });
        } else {
          console.log("No Courier Boys Available:: Waiting For Admin Response");
          var updateorder = {
            note: "All Courier Boys Are Busy. Please wait for response.",
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
      var checkif = await orderSchema.find({ _id: orderId, isActive: true });
      if (checkif.length != 0) {
        await orderSchema.findOneAndUpdate(
          { _id: orderId, courierId: courierId },
          { note: "Delivery boy reached to Pickup Point" }
        );
        var data = { plat: location.latitude, plong: location.longitude };
        await ExtatimeSchema.findOneAndUpdate(
          { courierId: courierId, orderId: orderId },
          data
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

router.post("/reachDropPoint", async function (req, res, next) {
  const { courierId, orderId } = req.body;
  try {
    var checkif = await orderSchema.find({ _id: orderId, isActive: true });
    if (checkif.length != 0) {
      await orderSchema.findOneAndUpdate(
        { _id: orderId, courierId: courierId },
        { note: "Order Delivered", isActive: false }
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
    status: "TakeThisOrder",
  });
  var datalist = [];
  if (data.length != 0) {
    for (var i = 0; i < data.length; i++) {
      var orderdata = await orderSchema.findOne({
        _id: data[i].orderId,
        courierId: courierId,
        isActive: true,
      });
      datalist.push(orderdata);
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

function getOrderNumber() {
  let orderNo = "ORD-" + Math.floor(Math.random() * 90000) + 10000;
  return orderNo;
}

async function sendPushNotification(fcmtoken, title, body) {
  let payload = { notification: { title: title, body: body } };
  let options = { priority: "high", timeToLive: 60 * 60 * 24 };
  let response = await config.firebase
    .messaging()
    .sendToDevice(fcmtoken, payload, options);
  return response;
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
