//INITIATING LIBRARIES
require('dotenv').config();
var path = require('path');
var fs = require('fs');
var axios = require('axios');
var multer = require('multer');
var express = require('express');
var config = require('../config');
var router = express.Router();
var arraySort = require('array-sort');
const {getDistance,convertDistance} = require('geolib');

//SCHEMAS
var orderSchema = require('../data_models/new-order');
var courierSchema = require('../data_models/courier-signup');
var locationSchema = require('../data_models/courier-location');
var requestSchema = require('../data_models/order-request');

//API ROUTES
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Invalid URL' });
});


//CUSTOMER APP API
router.post('/newoder',async function(req,res,next){
    const {
        customerId,deliveryType,weightLimit,pkName,pkMobileNo,pkAddress,pkLat,pkLong,
        pkCompleteAddress,pkContent,pkArriveType,pkArriveTime,dpName,dpMobileNo,
        dpAddress,dpLat,dpLong,dpCompleteAddress,dpDistance,collectCash,promoCode,
        amount,discount,finalAmount
    } = req.body;
    try{
      var newOrder = new orderSchema({
        _id:new config.mongoose.Types.ObjectId(),
        customerId:customerId,
        deliveryType:deliveryType,
        weightLimit:weightLimit,
        pickupPoint:{
            name:pkName,
            mobileNo:pkMobileNo,
            address:pkAddress,
            lat:pkLat,
            long:pkLong,
            completeAddress:pkCompleteAddress,
            contents:pkContent,
            arriveType:pkArriveType,
            arriveTime:pkArriveTime,
        },
        deliveryPoint:{
            name:dpName,
            mobileNo:dpMobileNo,
            address:dpAddress,
            lat:dpLat,
            long:dpLong,
            completeAddress:dpCompleteAddress,
            distance:dpDistance
        },
        collectCash:collectCash,
        promoCode:promoCode,
        amount:amount,
        discount:discount,
        finalAmount:finalAmount,
        status:pkArriveType=="RightNow"?"Finding":"Scheduled",
        note:pkArriveType=="RightNow"?"Finding Delivery Boy Near By You!":"Your Order is Scheduled"
      });
      
      if(dpDistance <=15){
          var placedorder = await newOrder.save();
          var avlcourier = await avlCourierBoy(pkLat,pkLong,placedorder.id);

          if(placedorder!=null && avlcourier.length!=0){
            
            console.log("Courier Boys Available");
            //find NearByCourierBoy
            let courierfound = arraySort(avlcourier,'distance');
            console.log(courierfound[0]);
            var newrequest = new requestSchema({
              _id:new config.mongoose.Types.ObjectId(),
              courierId:courierfound[0].courierId,
              orderId:courierfound[0].orderId,
              distance:courierfound[0].distance,
              status:courierfound[0].status,
              reason:courierfound[0].reason,
              fcmToken:courierfound[0].fcmToken,
            });
            await newrequest.save();
            var payload = {
              notification: {
                title: "Order Alert",
                body: "New Order Alert Found For You."
              },
              data: {
                orderid: courierfound[0].orderId,
                distance: courierfound[0].distance
              }
            };

            var options = {
              priority: "high",
              timeToLive: 60 * 60 *24
            };
            config.firebase.messaging().sendToDevice(courierfound[0].fcmToken,payload,options);
          }else{
           
            console.log("No Courier Boys Available:: Waiting For Admin Response");
            var updateorder = ({
              note:"All Courier Boys Are Busy. Please wait for response.",
              status:"Admin"
            });
            await orderSchema.findByIdAndUpdate(placedorder.id,updateorder);

          }
        res.status(200)
        .json({Message:"Order Placed!",Data:1,IsSuccess:true});
      }else{
        res.status(200)
        .json({Message:"Distance is Over 15KM !",Data:0,IsSuccess:true});
      }
    }catch(err){
      res.status(500)
      .json({Message:err.message,Data:0,IsSuccess:false});
    }
});

async function avlCourierBoy(pick_lat,pick_long,orderid){

  var availableCouriers = [];
  var getCourierIds = await courierSchema.find({isActive:true,"accStatus.flag":true}).select('id fcmToken');
  for(var i=0;i<getCourierIds.length;i++){
    var getlocation = await locationSchema.find({courierId:getCourierIds[0].id}).sort({'_id':-1}).limit(1);
    if(getlocation.length == 1 && getlocation[0].duty=="ON")
    {
      let counters = await requestSchema.countDocuments({orderId:orderid});
      if(counters <=3){
        let data = await requestSchema.find({courierId:getCourierIds[0].id,orderId:orderid});
        if(data.length ==0){
          let courierLocation = {latitude:getlocation[0].latitude,longitude:getlocation[0].longitude};
          let pickLocation = {latitude:pick_lat,longitude:pick_long};
          var distance = convertDistance(getDistance(courierLocation,pickLocation,1000),'km');
          if(distance<=15){
            availableCouriers.push({
              courierId:getCourierIds[0].id,
              orderId:orderid,
              distance:distance,
              status:"Pending",
              fcmToken:getCourierIds[0].fcmToken,
              reason:"",
            });
          }
        }
      }
    }
  }
  return availableCouriers;
}

router.post('/activeOrders',async function(req,res,next){
  const {customerId} = req.body;
  try{
    orderSchema.find({customerId:customerId,isActive:true})
    .populate('courierId','firstName lastName fcmToken mobileNo accStatus transport isVerified')
    .exec()
    .then(docs=>{
      if(docs.length!=0){
        res.status(200)
        .json({Message:"Order Found!",Data:docs,IsSuccess:true});
      }else{
        res.status(200)
        .json({Message:"No Order Found!",Data:docs,IsSuccess:true});
      }
    });
  }catch(err){
    res.status(500)
    .json({Message:err.message,Data:0,IsSuccess:false});
  }
});

router.post('/completeOrders',async function(req,res,next){
  const {customerId} = req.body;
  try{
    orderSchema.find({customerId:customerId,isActive:false})
    .populate('courierId','firstName lastName fcmToken mobileNo accStatus transport isVerified')
    .exec()
    .then(docs=>{
      if(docs.length!=0){
        res.status(200)
        .json({Message:"Order Found!",Data:docs,IsSuccess:true});
      }else{
        res.status(200)
        .json({Message:"No Order Found!",Data:docs,IsSuccess:true});
      }
    });
  }catch(err){
    res.status(500)
    .json({Message:err.message,Data:0,IsSuccess:false});
  }
});


//COURIER BOY APP API
router.post('/acceptOrder',async function(req,res,next){
  const {courierId,orderId} = req.body;
  try{
    var checkif = await requestSchema.find({orderId:orderId,status:"Accept"});
    if(checkif.length==0){
      await requestSchema.findOneAndUpdate({orderId:orderId,courierId:courierId},{status:"Accept"});
      await orderSchema.findByIdAndUpdate(orderId,{courierId:courierId});
      res.status(200)
      .json({Message:"Order Accepted!",Data:1,IsSuccess:true});
    }else{
      res.status(200)
      .json({Message:"Order Not Available!",Data:0,IsSuccess:true});
    }
  }catch(err){
    res.status(500)
    .json({Message:err.message,Data:0,IsSuccess:false});
  }
});

router.post('/rejectOrder',async function(req,res,next){
  const {courierId,orderId,reason} = req.body;
  try{
    var updateRejection = await requestSchema.findOneAndUpdate({courierId:courierId,orderId:orderId},{status:"Reject",reason:reason});
    if(updateRejection!=null){
      var orderData = await orderSchema.find({'_id':orderId,isActive:true});
      if(orderData.length!=0){
        var avlcourier = await avlCourierBoy(orderData[0].pickupPoint.lat,orderData[0].pickupPoint.long,orderId);
          if(avlcourier.length!=0){
            console.log("Courier Boys Available");
            let courierfound = arraySort(avlcourier,'distance');
              let newrequest = new requestSchema({
                _id:new config.mongoose.Types.ObjectId(),
                courierId:courierfound[0].courierId,
                orderId:courierfound[0].orderId,
                distance:courierfound[0].distance,
                status:courierfound[0].status,
                reason:courierfound[0].reason,
                fcmToken:courierfound[0].fcmToken,
              });
            await newrequest.save();
          }else{
            console.log("No Courier Boys Available:: Waiting For Admin Response");
            var updateorder = ({
              note:"All Courier Boys Are Busy. Please wait for response.",
              status:"Admin"
            });
            await orderSchema.findByIdAndUpdate(placedorder.id,updateorder);
          }
      }
    }
  }catch(err){
    res.status(500)
    .json({Message:err.message,Data:0,IsSuccess:false});
  }
});

router.post('/noResponseOrder',async function(req,res,next){
  const {courierId,orderId} = req.body;
  try{
    var updateRejection = await requestSchema.findOneAndUpdate({courierId:courierId,orderId:orderId},{status:"NoResponse",reason:"Not Responded By Delivery Boy"});
    if(updateRejection!=null){
      var orderData = await orderSchema.find({'_id':orderId,isActive:true});
      if(orderData.length!=0){
        var avlcourier = await avlCourierBoy(orderData[0].pickupPoint.lat,orderData[0].pickupPoint.long,orderId);
          if(avlcourier.length!=0){
            console.log("Courier Boys Available");
            let courierfound = arraySort(avlcourier,'distance');
              let newrequest = new requestSchema({
                _id:new config.mongoose.Types.ObjectId(),
                courierId:courierfound[0].courierId,
                orderId:courierfound[0].orderId,
                distance:courierfound[0].distance,
                status:courierfound[0].status,
                reason:courierfound[0].reason,
                fcmToken:courierfound[0].fcmToken,
              });
            await newrequest.save();
          }else{
            console.log("No Courier Boys Available:: Waiting For Admin Response");
            var updateorder = ({
              note:"All Courier Boys Are Busy. Please wait for response.",
              status:"Admin"
            });
            await orderSchema.findByIdAndUpdate(placedorder.id,updateorder);
          }
      }
    }
  }catch(err){
    res.status(500)
    .json({Message:err.message,Data:0,IsSuccess:false});
  }
});

router.post('/reachPickPoint',async function(req,res,next){
  const {courierId,orderId} = req.body;
  try{
    var checkif = await orderSchema.find({'_id':orderId,isActive:true});
    if(checkif.length!=0){
      await orderSchema.findOneAndUpdate({'_id':orderId,courierId:courierId},{note:"Delivery boy reached to Pickup Point"});
      res.status(200)
      .json({Message:"Reached Pickup Point!",Data:1,IsSuccess:true});
    }else{
      res.status(200)
      .json({Message:"Order Not Available!",Data:0,IsSuccess:true});
    }
  }catch(err){
    res.status(500)
    .json({Message:err.message,Data:0,IsSuccess:false});
  }
});

router.post('/reachDropPoint',async function(req,res,next){
  const {courierId,orderId} = req.body;
  try{
    var checkif = await orderSchema.find({'_id':orderId,isActive:true});
    if(checkif.length!=0){
      await orderSchema.findOneAndUpdate({'_id':orderId,courierId:courierId},
      {note:"Order Delivered",isActive:false});

      res.status(200)
      .json({Message:"Order Delivered!",Data:1,IsSuccess:true});
    }else{
      res.status(200)
      .json({Message:"Order Not Available!",Data:0,IsSuccess:true});
    }
  }catch(err){
    res.status(500)
    .json({Message:err.message,Data:0,IsSuccess:false});
  }
});

router.post('/c_activeOrder',async function(req,res,next){
  const {courierId} = req.body;
  var data = await orderSchema.find({courierId:courierId,isActive:true});
  if(data.length!=0){
    res.status(200)
    .json({Message:"Orders Found!",Data:data,IsSuccess:true});
  }else{
    res.status(200)
    .json({Message:"No Orders Found!",Data:data,IsSuccess:true});
  }
});

router.post('/c_completeOrder',async function(req,res,next){
  const {courierId} = req.body;
  var data = await orderSchema.find({courierId:courierId,isActive:false});
  if(data.length!=0){
    res.status(200)
    .json({Message:"Orders Found!",Data:data,IsSuccess:true});
  }else{
    res.status(200)
    .json({Message:"No Orders Found!",Data:data,IsSuccess:true});
  }
});




module.exports = router;