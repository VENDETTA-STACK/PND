// Initiating Libraries
require('dotenv').config();
var path = require('path');
var fs = require('fs');
var axios = require('axios');
var express = require('express');
var config = require('../config');
var router = express.Router();
var cors = require('cors');

/* Data Models */
var adminSchema = require('../data_models/a-signup');
var settingsSchema = require('../data_models/o-settings');
var orderSchema = require('../data_models/new-order');
var courierSchema = require('../data_models/courier-signup');

router.post('/signup',cors(),async function(req,res,next){
    const {name,username,password,type} = req.body;
    try{
        var existAdmin = await adminSchema.find({username:username.toLowerCase()});
        if(existAdmin.length!=0){
            res.status(200)
            .json({Message:"username is already taken!",Data:0,IsSuccess:true});
        }else{
            let newadmin = new adminSchema({
                _id:new config.mongoose.Types.ObjectId(),
                name:name.toLowerCase(),
                username:username.toLowerCase(),
                password:password.toLowerCase(),
                type:type.toLowerCase()
            });
            await newadmin.save();
            res.status(200)
            .json({Message:"new user registered!",Data:0,IsSuccess:true});
        }
    }catch(err){
        res.status(500)
        .json({Message:err.message,Data:0,IsSuccess:false});
    }
});

router.post('/login',cors(),async function(req,res,next){
    const {username,password,type} = req.body;
    try{
        var existAdmin = await adminSchema.find(
            {   username:username.toLowerCase(),
                password:password.toLowerCase(),
                type:type.toLowerCase()});
        if(existAdmin.length!=0){
            res.status(200)
            .json({Message:"user found!",Data:existAdmin,IsSuccess:true});
        }else{
            res.status(200)
            .json({Message:"user not found!",Data:existAdmin,IsSuccess:true});
        }
    }catch(err){
        res.status(500)
        .json({Message:err.message,Data:0,IsSuccess:false});
    }
});

router.post('/validate',cors(),async function(req,res,next){
    const {id,type} = req.body;
    try{
        var existAdmin = await adminSchema.find({'_id':id,type:type});
        if(existAdmin.length!=0){
            res.status(200)
            .json({Message:"user found!",Data:existAdmin,IsSuccess:true});
        }else{
            res.status(200)
            .json({Message:"user not found!",Data:existAdmin,IsSuccess:true});
        }
    }catch(err){
        res.status(500)
        .json({Message:err.message,Data:0,IsSuccess:false});
    }
});

router.post('/updatesetttings',cors(),async function(req,res,next){
    const {PerUnder5KM,PerKM,ExpDelivery} = req.body;
    try{
        var existData = await settingsSchema.find({});
        if(existData.length == 1){
            let id = existData[0].id;
            let updatedsettings = {PerUnder5KM:PerUnder5KM,PerKM:PerKM,ExpDelivery:ExpDelivery};
            await settingsSchema.findByIdAndUpdate(id,updatedsettings);
            res.status(200)
            .json({Message:"Settings Updated!",Data:1,IsSuccess:true});
        }else{
            var newsettings = new settingsSchema({PerUnder5KM:PerUnder5KM,PerKM:PerKM,ExpDelivery:ExpDelivery});
            await newsettings.save();
            res.status(200)
            .json({Message:"Settings Created!",Data:1,IsSuccess:true});
        }
    }catch(err){
        res.status(500)
        .json({Message:err.message,Data:0,IsSuccess:false});
    }
});

router.post('/settings',cors(),async function(req,res,next){
    try{
      var getsettings = await settingsSchema.find({});
      if(getsettings.length == 1){
        res.status(200)
        .json({Message:"Settings Found!",Data:getsettings,IsSuccess:true});
      }else{
        res.status(200)
        .json({Message:"Settings Not Found!",Data:getsettings,IsSuccess:true});
      }
    }catch(err){
      res.status(500)
      .json({Message:err.message,Data:0,IsSuccess:false});
    }
});

router.post('/orders',cors(),async function(req,res,next){
    try{
      orderSchema.find({})
      .populate('courierId','firstName lastName fcmToken mobileNo accStatus transport isVerified')
      .populate('customerId')
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

router.post('/couriers',cors(),async function(req,res,next){
    try{
       courierSchema.find({})
      .exec()
      .then(docs=>{
        if(docs.length!=0){
          res.status(200)
          .json({Message:"Courier Found!",Data:docs,IsSuccess:true});
        }else{
          res.status(200)
          .json({Message:"No Courier Found!",Data:docs,IsSuccess:true});
        }
      });
    }catch(err){
      res.status(500)
      .json({Message:err.message,Data:0,IsSuccess:false});
    }
});

router.post('/users',cors(),async function(req,res,next){
    try{
       adminSchema.find({})
      .exec()
      .then(docs=>{
        if(docs.length!=0){
          res.status(200)
          .json({Message:"Users Found!",Data:docs,IsSuccess:true});
        }else{
          res.status(200)
          .json({Message:"No Users Found!",Data:docs,IsSuccess:true});
        }
      });
    }catch(err){
      res.status(500)
      .json({Message:err.message,Data:0,IsSuccess:false});
    }
});
module.exports = router;