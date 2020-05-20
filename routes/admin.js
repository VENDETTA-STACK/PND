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
var locationSchema = require('../data_models/courier-location');

router.post('/signup',async function(req,res,next){
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

router.post('/login',async function(req,res,next){
    const {username,password,type} = req.body;
    try{
        var existAdmin = await adminSchema.find(
            {   username:username,
                password:password,
                type:type});
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

router.post('/validate',async function(req,res,next){
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

router.post('/updatesetttings',async function(req,res,next){
    const {PerUnder5KM,PerKM,ExpDelivery,ReferalPoint} = req.body;
    try{
        var existData = await settingsSchema.find({});
        if(existData.length == 1){
            let id = existData[0].id;
            let updatedsettings = {PerUnder5KM:PerUnder5KM,PerKM:PerKM,ExpDelivery:ExpDelivery,ReferalPoint:ReferalPoint};
            await settingsSchema.findByIdAndUpdate(id,updatedsettings);
            res.status(200)
            .json({Message:"Settings Updated!",Data:1,IsSuccess:true});
        }else{
            var newsettings = new settingsSchema({_id:new config.mongoose.Types.ObjectId(),
              PerUnder5KM:PerUnder5KM,
              PerKM:PerKM,
              ExpDelivery:ExpDelivery,
              ReferalPoint:ReferalPoint});
            await newsettings.save();
            res.status(200)
            .json({Message:"Settings Created!",Data:1,IsSuccess:true});
        }
    }catch(err){
        res.status(500)
        .json({Message:err.message,Data:0,IsSuccess:false});
    }
});

router.post('/settings',async function(req,res,next){
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

router.post('/orders',async function(req,res,next){
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

router.post('/couriers',async function(req,res,next){
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
 
router.post('/couriersIsApproval',async function(req,res,next){
  const id = req.body.id;
  try{
    let courierApp = await courierSchema.find({'_id':id});
    if(courierApp.length==1){
      if(courierApp[0].accStatus.flag == true){
        await courierSchema.findByIdAndUpdate(id,{"accStatus.flag":false,"accStatus.message":"Waiting For Administrator Approval"});
        res.status(200)
        .json({Message:"Account Status Updated!",Data:1,IsSuccess:true});
      }else{
        await courierSchema.findByIdAndUpdate(id,{"accStatus.flag":true,"accStatus.message":"Approved"});
        res.status(200)
        .json({Message:"Account Status Updated!",Data:1,IsSuccess:true});
      }
    }else{
      res.status(200)
      .json({Message:"Account Status Not Updated!",Data:0,IsSuccess:true});
    }
  }catch(err){
    res.status(500)
      .json({Message:err.message,Data:0,IsSuccess:false});
  }
});

router.post('/couriersIsActive',async function(req,res,next){
  const id = req.body.id;
  try{
    let courierApp = await courierSchema.find({'_id':id});
    if(courierApp.length==1){
      if(courierApp[0].isActive == true){
        await courierSchema.findByIdAndUpdate(id,{isActive:false});
        res.status(200)
        .json({Message:"Account Status Updated!",Data:1,IsSuccess:true});
      }else{
        await courierSchema.findByIdAndUpdate(id,{isActive:true});
        res.status(200)
        .json({Message:"Account Status Updated!",Data:1,IsSuccess:true});
      }
    }else{
      res.status(200)
      .json({Message:"Account Status Not Updated!",Data:0,IsSuccess:true});
    }
  }catch(err){
    res.status(500)
      .json({Message:err.message,Data:0,IsSuccess:false});
  }
});

router.post('/couriersDelete',async function(req,res,next){
  const id = req.body.id;
  try{
      var data = await courierSchema.find({'_id':id});
      if(data.length == 1){
        
        //Removing Uploaded Files
        var old = data[0].profileImg;
        if(fs.existsSync(old.replace('\\g','/'))){fs.unlinkSync(old.replace('\\g','/'));} 
        old = data[0].poaFrontImg;
        if(fs.existsSync(old.replace('\\g','/'))){fs.unlinkSync(old.replace('\\g','/'));} 
        old = data[0].poaBackImg;
        if(fs.existsSync(old.replace('\\g','/'))){fs.unlinkSync(old.replace('\\g','/'));}
        old = data[0].panCardImg;
        if(fs.existsSync(old.replace('\\g','/'))){fs.unlinkSync(old.replace('\\g','/'));}

        await courierSchema.findByIdAndDelete(id);
        res.status(200)
        .json({Message:"Account Not Deleted!",Data:1,IsSuccess:true});
      }else{
        res.status(200)
        .json({Message:"Account Not Deleted!",Data:0,IsSuccess:true});
      }
  }catch(err){
    res.status(500)
      .json({Message:err.message,Data:0,IsSuccess:false});
  }
});

router.post('/users',async function(req,res,next){
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

router.post('/courierLocations',async function(req,res,next){
  var listOfCourierBoy = [];
  var listIds = await courierSchema.find({isActive:true,"accStatus.flag":true}).select('id firstName lastName');
  for(var i=0;i<listIds.length;i++){
    var getlocation = await locationSchema.find({courierId:listIds[i].id}).sort({'_id':-1}).limit(1);
    if(getlocation.length == 1 && getlocation[0].duty=="ON"){
      let name = listIds[0].firstName +' '+listIds[0].lastName;
      let lat = Number(getlocation[0].latitude);
      let long = Number(getlocation[0].longitude);
      let Din = i+1;
      var data = [name,lat,long,Din];
      listOfCourierBoy.push(data);
      console.log(data);
    }
  }
  res.status(200).json(listOfCourierBoy);
});

router.post('/getLiveLocation',async function(req,res,next){
  var list_courier = [];
  var listIds = await courierSchema.find({isActive:true,"accStatus.flag":true}).select('id firstName lastName');
  var counter = 0;
  for(let i=0;i<listIds.length;i++){
    let location = await getcuurentlocation(listIds[i].id);
    console.log(location);
    if(location!=null && location.duty=="ON"){
      counter++;
      let name = listIds[i].firstName +' '+listIds[i].lastName;
      let lat = Number(location.latitude);
      let long = Number(location.longitude);
      var data = [name,lat,long,counter];
      list_courier.push(data);
      console.log(data);
    }
  }
  res.status(200).json(list_courier);
});

async function getcuurentlocation(id){
  var CourierRef = config.docref.child(id);
  const data = await CourierRef.once("value").then(snapshot=>snapshot.val()).catch(err=>err);
  return data;
}

module.exports = router;