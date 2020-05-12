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
var adminSchema = require('../data_models/admin-create');

/* Routes. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Invalid URL' });
});

router.post('/createAdmin',cors(),async function(req,res,next){
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

router.post('/adminLogin',cors(),async function(req,res,next){
    const {username,password,type} = req.body;
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
});

router.post('/validateAdmin',cors(),async function(req,res,next){
    const {id,type} = req.body;
    var existAdmin = await adminSchema.find({'_id':id,type:type});
    if(existAdmin.length!=0){
        res.status(200)
        .json({Message:"user found!",Data:existAdmin,IsSuccess:true});
    }else{
        res.status(200)
        .json({Message:"user not found!",Data:existAdmin,IsSuccess:true});
    }
});

module.exports = router;