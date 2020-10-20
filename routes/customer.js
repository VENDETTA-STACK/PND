require("dotenv").config();
var express = require("express");
var multer = require("multer");
var path = require("path");
var axios = require("axios");
var router = express.Router();
var config = require("../config");
var upload = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, "uploads/customers");
    },
    filename: function(req, file, cb) {
        cb(
            null,
            file.fieldname + "_" + Date.now() + path.extname(file.originalname)
        );
    },
});
var uploadpic = multer({ storage: upload });

/* Data Models */
var customerSchema = require("../data_models/customer.signup.model");
var pickupAddressSchema = require("../data_models/pickupaddresses.model");
var settingsSchema = require("../data_models/settings.model");
var bannerSchema = require("../data_models/banner.model");
var promoCodeSchema = require("../data_models/promocode.model");
var usedpromoSchema = require("../data_models/used.promocode.model");
var parcelcategories = require("../data_models/category.model");

/* Routes. */
router.get("/", function(req, res, next) {
    res.render("index", { title: "Invalid URL" });
});

//required functions
function registrationCode() {
    var result = "";
    var fourdigitsrandom = Math.floor(1000 + Math.random() * 9000);
    var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var charactersLength = characters.length;
    for (var i = 0; i < 4; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    var finalcode = result + "" + fourdigitsrandom;
    return finalcode;
}

// customers app APIs
router.post("/signup", async function(req, res, next) {
    const { name, mobileNo, email, referalCode } = req.body;
    try {
        let existCustomer = await customerSchema.find({ mobileNo: mobileNo });
        if (existCustomer.length == 1) {
            res.status(200).json({
                Message: "Customer Already Registered!",
                Data: 0,
                IsSuccess: true,
            });
        } else {
            let newCustomer = new customerSchema({
                _id: new config.mongoose.Types.ObjectId(),
                name: name,
                email: email,
                mobileNo: mobileNo,
                referalCode: referalCode,
                regCode: registrationCode(),
            });
            newCustomer.save();
            res
                .status(200)
                .json({ Message: "Customer Registered!", Data: 1, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/signup2", async function(req, res, next) {
    const { name, mobileNo, email, referalCode } = req.body;
    try {
        let existCustomer = await customerSchema.find({ mobileNo: mobileNo });
        if (existCustomer.length == 1) {
            let b = [];
            res.status(200).json({
                Message: "Customer Already Registered!",
                Data: b,
                IsSuccess: true,
            });
        } else {
            let banks = [];
            let newCustomer = new customerSchema({
                _id: new config.mongoose.Types.ObjectId(),
                name: name,
                email: email,
                mobileNo: mobileNo,
                referalCode: referalCode,
                regCode: registrationCode(),
            });
            let data = await newCustomer.save();
            if (data != null) {
                let newdata = [data];
                res
                    .status(200)
                    .json({
                        Message: "Customer Registered!",
                        Data: newdata,
                        IsSuccess: true,
                    });
            }
        }
    } catch (err) {
        let b = [];
        res.status(500).json({ Message: err.message, Data: b, IsSuccess: false });
    }
});

router.post("/sendotp", async function(req, res, next) {
    const { mobileNo, code, appSignature } = req.body;
    try {
        let message = "Your verification code is " + code + " " + appSignature;
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
        let getresponse = await axios.get(msgportal);
        if (getresponse.data.ErrorMessage == "Success") {
            res
                .status(200)
                .json({ Message: "Message Sent!", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Message Not Sent!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

/* router.post("/verify", async function(req, res, next) {
    onst { mobileNo, fcmToken } = req.body;
    try {
        let updateCustomer = await customerSchema.findOneAndUpdate({ mobileNo: mobileNo }, { isVerified: true, fcmToken: fcmToken });
        if (updateCustomer != null) {
            res
                .status(200)
                .json({ Message: "Verification Complete!", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Verification Failed!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
}); */

//20-10-2020 ----- FCM Token remove cause if no fcm token then user cant login/register
router.post("/verify", async function(req, res, next) {
    const { mobileNo } = req.body;
    try {
        let updateCustomer = await customerSchema.findOneAndUpdate({ mobileNo: mobileNo }, { isVerified: true, fcmToken: fcmToken });
        console.log(updateCustomer);

        if (updateCustomer != null) {
            res
                .status(200)
                .json({ Message: "Verification Complete!", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Verification Failed!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/signin", async function(req, res, next) {
    const { mobileNo } = req.body;
    try {
        let existCustomer = await customerSchema.find({
            mobileNo: mobileNo,
            isVerified: true,
            isActive: true,
        });
        if (existCustomer.length == 1) {
            res.status(200).json({
                Message: "Customer Found!",
                Data: existCustomer,
                IsSuccess: true,
            });
        } else {
            res.status(200).json({
                Message: "Customer Not Found!",
                Data: existCustomer,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/updateprofile", uploadpic.single("profilepic"), async function(
    req,
    res,
    next
) {
    const file = req.file;
    const { id, name, email } = req.body;
    try {
        if (file != undefined) {
            let existCustomer = await customerSchema.findByIdAndUpdate(id, {
                name: name,
                email: email,
                image: file.path,
            });
            if (existCustomer != null)
                res
                .status(200)
                .json({ Message: "Profile Updated!", Data: 1, IsSuccess: true });
            else
                res
                .status(200)
                .json({ Message: "Profile Not Updated!", Data: 0, IsSuccess: true });
        } else {
            let existCustomer = await customerSchema.findByIdAndUpdate(id, {
                name: name,
                email: email,
            });
            if (existCustomer != null)
                res
                .status(200)
                .json({ Message: "Profile Updated!", Data: 1, IsSuccess: true });
            else
                res
                .status(200)
                .json({ Message: "Profile Not Updated!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/savePickupAddress", async function(req, res, next) {
    const {
        customerId,
        name,
        mobileNo,
        address,
        lat,
        long,
        completeAddress,
    } = req.body;
    try {
        let newaddress = new pickupAddressSchema({
            _id: new config.mongoose.Types.ObjectId(),
            name: name,
            mobileNo: mobileNo,
            address: address,
            lat: lat,
            long: long,
            completeAddress: completeAddress,
            customerId: customerId,
        });
        await newaddress.save();
        res
            .status(200)
            .json({ Message: "Address Added!", Data: 1, IsSuccess: true });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/pickupAddress", async function(req, res, next) {
    const { customerId } = req.body;
    try {
        var getaddress = await pickupAddressSchema.find({ customerId: customerId });
        if (getaddress.length != 0) {
            res.status(200).json({
                Message: "Pickup Address Found!",
                Data: getaddress,
                IsSuccess: true,
            });
        } else {
            res.status(200).json({
                Message: "Pickup Address Not Added!",
                Data: getaddress,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/banners", async(req, res, next) => {
    try {
        let bannerlist = await bannerSchema.find({});
        let categories = await parcelcategories.find({});
        let datalist = [{
            banners: bannerlist,
            categories: categories
        }];
        res.json({ Message: "Banners List!", Data: datalist, IsSuccess: true });
    } catch (err) {
        res.json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

// show availble promocodes for a purticular customer
router.post("/promocodes", async function(req, res, next) {
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
            res
                .status(200)
                .json({
                    Message: "Promocodes Found!",
                    Data: datasets,
                    IsSuccess: true,
                });
        } else {
            res
                .status(200)
                .json({
                    Message: "No Promocodes Found!",
                    Data: datasets,
                    IsSuccess: true,
                });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post('/getOtp', (req, res, next) => {
    console.log("---------------------hello logout----------------------");
    res.json({
        Message: "Customer Logout!",
        Data: 0,
        IsSuccess: true
    })
});

module.exports = router;