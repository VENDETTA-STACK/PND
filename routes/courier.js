/* Initiating Libraries */
require("dotenv").config();
var path = require("path");
var fs = require("fs");
var axios = require("axios");
var multer = require("multer");
var express = require("express");
var config = require("../config");
var router = express.Router();

/* Creating FileUpload Path */
var filestorage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, "uploads/couriers");
    },
    filename: function(req, file, cb) {
        cb(
            null,
            file.fieldname + "_" + Date.now() + path.extname(file.originalname)
        );
    },
});
var finalstorage = multer({ storage: filestorage });
var fieldset = finalstorage.fields([
    { name: "profileImg", maxCount: 1 },
    { name: "poaFrontImg", maxCount: 1 },
    { name: "poaBackImg", maxCount: 1 },
    { name: "panCardImg", maxCount: 1 },
    { name: "electricityImg", maxCount: 1 },
    { name: "policeVerificationImg", maxCount: 1 },
]);

/* Data Models */
var courierSchema = require("../data_models/courier.signup.model");
var courierNotificationSchema = require("../data_models/courier.notification.model");
var locationLoggerSchema = require("../data_models/location.logger.model");

/* Routes. */
router.get("/", function(req, res, next) {
    res.render("index", { title: "Invalid URL" });
});

//couriers signup
router.post("/signup", fieldset, async function(req, res, next) {
    const { firstName, lastName, mobileNo, poaType } = req.body;
    try {
        var existCourier = await courierSchema.find({ mobileNo: mobileNo });
        if (existCourier.length == 1) {
            //Removing Uploaded Files
            var old = req.files.profileImg[0].path;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }
            old = req.files.poaFrontImg[0].path;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }
            old = req.files.poaBackImg[0].path;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }

            old = req.files.panCardImg[0].path;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }

            old = req.files.electricityImg[0].path;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }

            old = req.files.policeVerificationImg[0].path;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }

            res.status(200).json({
                Message: "Courier Already Registered!",
                Data: 0,
                IsSuccess: true,
            });
        } else {
            //req.files.profileImg[0].path
            let cid = cidgenerator();
            var newCourier = new courierSchema({
                _id: new config.mongoose.Types.ObjectId(),
                cId: cid,
                firstName: firstName,
                lastName: lastName,
                mobileNo: mobileNo,
                poaType: poaType,
                profileImg: req.files.profileImg[0].path,
                poaFrontImg: req.files.poaFrontImg[0].path,
                poaBackImg: req.files.poaBackImg[0].path,
                panCardImg: req.files.panCardImg[0].path,
                electricityImg: req.files.electricityImg[0].path,
                policeVerificationImg: req.files.policeVerificationImg[0].path,
            });
            await newCourier.save();
            res
                .status(200)
                .json({ Message: "Courier Registered!", Data: 1, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//couriers sms
router.post("/sendotp", async function(req, res, next) {
    const { mobileNo, code } = req.body;
    try {
        let message = "Your verification code is " + code;
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

//couriers verify
router.post("/verify", async function(req, res, next) {
    const { mobileNo } = req.body;
    try {
        var existCourier = await courierSchema.findOneAndUpdate({ mobileNo: mobileNo }, { isVerified: true });
        console.log(existCourier);
        if (existCourier != null) {
            var newfirebase = config.docref.child(existCourier.id);
            newfirebase.set({
                latitude: "",
                longitude: "",
                duty: "OFF",
                parcel: 0,
            });
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

router.post("/updateFcmToken", async function(req, res, next) {
    const { courierId, fcmToken } = req.body;
    try {
        var existCourier = await courierSchema.findByIdAndUpdate(
            courierId, {
                fcmToken: fcmToken,
            }, { new: true }
        );
        if (existCourier != null) {
            res
                .status(200)
                .json({ Message: "FCM Token Updated!", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "FCM Token Not Updated!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//couriers Login
router.post("/signin", async function(req, res, next) {
    const { mobileNo } = req.body;
    try {
        var existCourier = await courierSchema.find({ mobileNo: mobileNo });
        if (existCourier.length == 1) {
            res.status(200).json({
                Message: "Customer Found!",
                Data: existCourier,
                IsSuccess: true,
            });
        } else {
            res.status(200).json({
                Message: "Customer Not Found!",
                Data: existCourier,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//update couriers profile
router.post("/updateprofile", async function(req, res, next) {
    const { id, firstName, lastName } = req.body;
    try {
        var existCourier = await courierSchema.findByIdAndUpdate(id, {
            firstName: firstName,
            lastName: lastName,
        });
        if (existCourier != null) {
            res
                .status(200)
                .json({ Message: "Profile Updated!", Data: 1, IsSuccess: true });
        } else {
            res.status(200).json({
                Message: "Profile Updation Failed!",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//update couriers bank details
router.post("/updatebank", async function(req, res, next) {
    const { id, ifscCode, bankName, accNo, branch } = req.body;
    try {
        var updateCourier = {
            bankDetail: {
                ifscCode: ifscCode,
                bankName: bankName,
                accNo: accNo,
                branch: branch,
            },
        };
        var existCourier = await courierSchema.findByIdAndUpdate(id, updateCourier);
        if (existCourier != null) {
            res
                .status(200)
                .json({ Message: "BankDetail Updated!", Data: 1, IsSuccess: true });
        } else {
            res.status(200).json({
                Message: "BankDetail Updation Failed !",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//update couriers vehicle data
router.post("/updatetransport", async function(req, res, next) {
    const { id, vehicleType, vehicleNo } = req.body;
    try {
        var updateCourier = {
            transport: {
                vehicleType: vehicleType,
                vehicleNo: vehicleNo,
            },
        };

        var existCourier = await courierSchema.findByIdAndUpdate(id, updateCourier);
        if (existCourier != null) {
            res
                .status(200)
                .json({ Message: "TrasportDetail Updated!", Data: 1, IsSuccess: true });
        } else {
            res.status(200).json({
                Message: "TrasportDetail Updation Failed !",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//get unreaded notification list of couriers
router.post("/notificationCounter", async function(req, res, next) {
    const courierId = req.body.courierId;
    try {
        let dataset = await courierNotificationSchema
            .find({ courierId: courierId })
            .countDocuments();
        res.json({
            Message: "Total Notification Found!",
            Data: dataset,
            IsSuccess: true,
        });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//get notification list of couriers
router.post("/courierNotification", async function(req, res, next) {
    const courierId = req.body.courierId;
    var set = await courierNotificationSchema.find({
        courierId: courierId,
        isRead: false,
    });
    if (set.length != 0) {
        for (let i = 0; i < set.length; i++) {
            await courierNotificationSchema.findByIdAndUpdate(set[0]._id, {
                isRead: true,
            });
        }
    }
    res
        .status(200)
        .json({ Message: "Notification Found!", Data: set, IsSuccess: true });
});

router.post("/sendNotification", async function(req, res, next) {
    const { courierId, title, description } = req.body;
    try {
        let dataset = await courierSchema.find({ _id: courierId });
        if (dataset.length == 1) {
            let newNotification = new courierNotificationSchema({
                _id: new config.mongoose.Types.ObjectId(),
                courierId: courierId,
                title: title,
                description: description,
            });

            let data = {
                type: "info",
                click_action: "FLUTTER_NOTIFICATION_CLICK",
            };

            var datdasa = await sendPopupNotification(
                dataset[0].fcmToken,
                title,
                description,
                data
            );
            console.log(datdasa);
            await newNotification.save();

            res.json({
                Message: "Notification Sent!",
                Data: 1,
                IsSuccess: true,
            });
        } else {
            res.json({
                Message: "Notification Not Sent!",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

async function sendPopupNotification(fcmtoken, title, body, data) {
    let payload = { notification: { title: title, body: body }, data: data };
    let options = { priority: "high", timeToLive: 60 * 60 * 24 };
    let response = await config.firebase
        .messaging()
        .sendToDevice(fcmtoken, payload, options);
    return response;
}

function cidgenerator() {
    let pnd = "PND";
    let pndno = pnd + "" + (Math.floor(Math.random() * 90000) + 10000).toString();
    return pndno;
}

async function getcuurentlocation(id) {
    var CourierRef = config.docref.child(id);
    const data = await CourierRef.once("value")
        .then((snapshot) => snapshot.val())
        .catch((err) => err);
    return data;
}

module.exports = router;