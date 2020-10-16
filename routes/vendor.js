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

router.post("/vendor_register", async function(req , res , next){
    const { name, mobileNo , company , email , gstNo , panNumber , lat , long , password} = req.body;
   
    let encryptPassword = Bcrypt.hashSync(req.body.password, 10);   
    console.log(encryptPassword);
    try {
        var vendor = new vendorModelSchema({
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
            password: encryptPassword
        });

        registerVendor = vendor.save();
        console.log(vendor);

        res.status(200).json({ Message: "Vendor Register Successfull...!!!", Data: vendor, IsSuccess: true });
    } catch (error) {
        res.status(400).json({ Message: "Register Unsuccessfull...!!!", IsSuccess: false });
    }

});

router.post("/vendor_login" , async function(req , res, next){
    const { email, password } = req.body;
    
    console.log(req.body);
    try {
        let userEmail = await vendorModelSchema.findOne({ email : email });
        console.log(userEmail.password);
        if(!userEmail) {
            return response.status(400).send({ message: "The username does not exist" });
        }
        if(!Bcrypt.compareSync(req.body.password, userEmail.password)) {
            return response.status(400).send({ message: "The password is invalid" });
        }
        res.send({ message: "The username and password combination is correct!" });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

module.exports = router;