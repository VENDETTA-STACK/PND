// Initiating Libraries
require("dotenv").config();
var path = require("path");
var fs = require("fs");
var axios = require("axios");
var express = require("express");
var config = require("../config");
var router = express.Router();
var cors = require("cors");
var multer = require("multer");
var request = require('request');
const { getDistance, convertDistance } = require("geolib");
const isEmpty = require('lodash.isempty');
const moment = require('moment-timezone');

//image uploading
var bannerlocation = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/banners");
    },
    filename: function (req, file, cb) {
        cb(
            null,
            file.fieldname + "_" + Date.now() + path.extname(file.originalname)
        );
    },
});
var uploadbanner = multer({ storage: bannerlocation });

var promocodelocation = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/promocodes");
    },
    filename: function (req, file, cb) {
        cb(
            null,
            file.fieldname + "_" + Date.now() + path.extname(file.originalname)
        );
    },
});
var uploadpromocode = multer({ storage: promocodelocation });

var policeverificationImg = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/couriers");
    },
    filename: function (req, file, cb) {
        cb(
            null,
            file.fieldname + "_" + Date.now() + path.extname(file.originalname)
        );
    },
});
var uploadpoliceImg = multer({ storage: policeverificationImg });

var categoryImg = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/categories");
    },
    filename: function (req, file, cb) {
        cb(
            null,
            file.fieldname + "_" + Date.now() + path.extname(file.originalname)
        );
    },
});
var uploadcategory = multer({ storage: categoryImg });

//Required Funtion
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

/* Data Models */
var adminSchema = require("../data_models/admin.signup.model");
var settingsSchema = require("../data_models/settings.model");
var orderSchema = require("../data_models/order.model");
var courierSchema = require("../data_models/courier.signup.model");
var ExtatimeSchema = require("../data_models/extratime.model");
var customerSchema = require("../data_models/customer.signup.model");
var requestSchema = require("../data_models/order.request.model");
var locationLoggerSchema = require("../data_models/location.logger.model");
var promocodeSchema = require("../data_models/promocode.model");
var bannerSchema = require("../data_models/banner.model");
var messageSchema = require("../data_models/message.creator.model");
var deliverytypesSchema = require("../data_models/deliverytype.model");
var poatypesSchema = require("../data_models/poatype.model");
var parcelcategories = require("../data_models/category.model");
var prooftypeSchema = require("../data_models/prooftype.modal");
var orderCancelSchema = require("../data_models/orderCancelReason");
var sumulOrderSchema = require('../data_models/sumulOrderModel');

async function currentLocation(id) {
    var CourierRef = config.docref.child(id);
    const data = await CourierRef.once("value")
        .then((snapshot) => snapshot.val())
        .catch((err) => err);
    return data;
}

//create adminpanel accounts
router.post("/signup", async function (req, res, next) {
    const { name, username, password, type } = req.body;
    try {
        var existAdmin = await adminSchema.find({
            username: username.toLowerCase(),
        });
        if (existAdmin.length != 0) {
            res.status(200).json({
                Message: "username is already taken!",
                Data: 0,
                IsSuccess: true,
            });
        } else {
            let newadmin = new adminSchema({
                _id: new config.mongoose.Types.ObjectId(),
                name: name.toLowerCase(),
                username: username.toLowerCase(),
                password: password.toLowerCase(),
                type: type.toLowerCase(),
            });
            await newadmin.save();
            res
                .status(200)
                .json({ Message: "new user registered!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//admin panel login
router.post("/login", async function (req, res, next) {
    const { username, password, type } = req.body;
    console.log(req.body);
    try {
        var existAdmin = await adminSchema.find({
            username: username,
            password: password,
            type: type,
        });
        if (existAdmin.length != 0) {
            res
                .status(200)
                .json({ Message: "user found!", Data: existAdmin, IsSuccess: true });
        } else {
            res.status(200).json({
                Message: "user not found!",
                Data: existAdmin,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//get dashboard counters
router.post("/dashcounters", async function (req, res, next) {
    try {
        let admins = await adminSchema.countDocuments();
        let couriers = await courierSchema.countDocuments();
        let totalOrders = await orderSchema.countDocuments();
        let customers = await customerSchema.countDocuments();
        let disapporved = await courierSchema
            .find({ "accStatus.flag": false })
            .countDocuments();
        let pendingOrders = await orderSchema
            .find({
                status: "Admin",
            })
            .countDocuments();

        let datalist = [];
        datalist.push({
            admins: admins,
            couriers: couriers,
            totalOrders: totalOrders,
            customers: customers,
            pendingOrders: pendingOrders,
            disapporved: disapporved,
        });
        res
            .status(200)
            .json({ Message: "Counters Found!", Data: datalist, IsSuccess: true });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//get verfied couriers for admin panel map
router.post("/getVerifiedCouriers", async function (req, res, next) {
    try {
        let dataset = await courierSchema
            .find({
                isActive: true,
                isVerified: true,
                "accStatus.flag": true,
            })
            .select("id cId firstName lastName");
        res
            .status(200)
            .json({ Message: "Counters Found!", Data: dataset, IsSuccess: true });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//get admin users listings
router.post("/adminusers", async function (req, res, next) {
    try {
        var existAdmin = await adminSchema.find();
        if (existAdmin.length != 0) {
            res
                .status(200)
                .json({ Message: "user found!", Data: existAdmin, IsSuccess: true });
        } else {
            res.status(200).json({
                Message: "user not found!",
                Data: existAdmin,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//update settings by admin panel
router.post("/updatesetttings", async function (req, res, next) {
    const {
        PerUnder5KM,
        PerKM,
        ReferalPoint,
        WhatsAppNo,
        DefaultWMessage,
        AppLink,
        AmountPayKM,
        FromTime,
        ToTime,
        CancelOrderTime,
        AdminMObile1,
        AdminMObile2,
        AdminMObile3,
        AdminMObile4,
        AdminMObile5,
    } = req.body;
    try {
        var existData = await settingsSchema.find({});
        if (existData.length == 1) {
            let id = existData[0].id;
            let updatedsettings = {
                PerUnder5KM: PerUnder5KM,
                PerKM: PerKM,
                ReferalPoint: ReferalPoint,
                WhatsAppNo: WhatsAppNo,
                DefaultWMessage: DefaultWMessage,
                AppLink: AppLink,
                AmountPayKM: AmountPayKM,
                FromTime: FromTime,
                ToTime: ToTime,
                NormalDelivery: "2.5 Hours",
                ExpressDelivery: "60 Minutes",
                CancelOrderTime: "30",
                AdminMObile1: AdminMObile1,
                AdminMObile2: AdminMObile2,
                AdminMObile3: AdminMObile3,
                AdminMObile4: AdminMObile4,
                AdminMObile5: AdminMObile5,
            };
            await settingsSchema.findByIdAndUpdate(id, updatedsettings);
            res
                .status(200)
                .json({ Message: "Settings Updated!", Data: 1, IsSuccess: true });
        } else {
            var newsettings = new settingsSchema({
                _id: new config.mongoose.Types.ObjectId(),
                PerUnder5KM: PerUnder5KM,
                PerKM: PerKM,
                ReferalPoint: ReferalPoint,
                WhatsAppNo: WhatsAppNo,
                DefaultWMessage: DefaultWMessage,
                AppLink: AppLink,
                AmountPayKM: AmountPayKM,
                FromTime: FromTime,
                ToTime: ToTime,
                NormalDelivery: "2.5 Hours",
                ExpressDelivery: "60 Minutes",
                CancelOrderTime: "30",
                AdminMObile1: AdminMObile1,
                AdminMObile2: AdminMObile2,
                AdminMObile3: AdminMObile3,
                AdminMObile4: AdminMObile4,
                AdminMObile5: AdminMObile5,
            });
            await newsettings.save();
            res
                .status(200)
                .json({ Message: "Settings Created!", Data: 1, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//get settings for mobile app
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

//list of orders with full details
router.post("/orders", async function (req, res, next) {
    try {
        let newdataset = [];

        let cancelledOrders = await orderSchema
            .find({ status: "Order Cancelled", isActive: false })
            .populate(
                "courierId",
                "firstName lastName fcmToken mobileNo accStatus transport isVerified"
            )
            .populate("customerId");

            console.log(cancelledOrders);

        let pendingOrders = await orderSchema
            .find({ status: "Admin" })
            .populate(
                "courierId",
                "firstName lastName fcmToken mobileNo accStatus transport isVerified"
            )
            .populate("customerId");

        let runningOrders = await orderSchema
            .find({
                $or: [
                    { status: "Order Processing" },
                    { status: "Order Picked" },
                    { status: "Order Assigned" },
                ],
            })
            .populate(
                "courierId",
                "firstName lastName fcmToken mobileNo accStatus transport isVerified"
            )
            .populate("customerId");

        // let cancelOrders = await requestSchema
        //     .find({
        //         $or: [
        //             { status: "Reject" }
        //         ],
        //     })
        //     .select('courierId orderId reason isActive');
        
            console.log("cancel order");
            //console.log(cancelOrders);
        //completed order API 
        // let completeOrders = await orderSchema
        //     .find({ status: "Order Delivered", isActive: false })
        //     .populate(
        //         "courierId",
        //         "firstName lastName fcmToken mobileNo accStatus transport isVerified"
        //     )
        //     .populate("customerId");

        // let orderscomplete = [];
        // for (let i = 0; i < completeOrders.length; i++) {
        //     let datadate = await ExtatimeSchema.find({
        //         orderId: completeOrders[i]._id,
        //     });
        //     orderscomplete.push({
        //         starttime: datadate[0].dateTime,
        //         endTime: datadate[0].deliverytime != null ? datadate[0].deliverytime : null,
        //         completeOrders: completeOrders[i],
        //     });
        // }

        //completeOrders: orderscomplete,
        newdataset.push({
            runningOrders: runningOrders,
            cancelledOrders: cancelledOrders,
            pendingOrders: pendingOrders,
        });
        // console.log("newdataset by meeeeeeeeee.....................!!!");
        // console.log(newdataset)

        res
            .status(200)
            .json({ Message: "Order Found!", Data: newdataset, IsSuccess: true });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//After order Changed Delivery Boy

// router.post("/updatedeliveryboy", async function(req, res, next){
//     console.log("hello");
//     const { firstName , lastName } = req.body;
//     console.log(req.body);
//     try {
//         var existOrderData = await orderSchema.find({
//             $or: [
//                 { status: "Order Processing" },
//                 { status: "Order Assigned" },
//             ],
//         });
//         console.log(existOrderData);
//         if(existOrderData.length == 1){
//             console.log("in dataset")
//             let ordId = existOrderData[0].orderNo;
//             console.log(ordId);
//         } 
//     } catch (err) {
//         res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
//     }
// }); 

//orders completed
router.post("/completed_orders", async function (req, res, next) {
    try {
        let newdataset = [];

        //completed order API 
        let completeOrders = await orderSchema
            .find({ status: "Order Delivered", isActive: false })
            .populate(
                "courierId",
                "firstName lastName fcmToken mobileNo accStatus transport isVerified"
            )
            .populate("customerId");

        let orderscomplete = [];
        for (let i = 0; i < completeOrders.length; i++) {
            let datadate = await ExtatimeSchema.find({
                orderId: completeOrders[i]._id,
            });
            orderscomplete.push({
                starttime: datadate[0].dateTime,
                endTime: datadate[0].deliverytime != null ? datadate[0].deliverytime : null,
                completeOrders: completeOrders[i],
            });
        }

        //completeOrders: orderscomplete,
        newdataset.push({
            completeOrders: orderscomplete,
        });

        res
            .status(200)
            .json({ Message: "Order Found!", Data: newdataset, IsSuccess: true });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//cancel Order
router.post("/cancelOrder", async function (req, res, next) {
    const id = req.body.id;
    try {
        let orderupdate = await orderSchema.find({ _id: id, isActive: true });
        if (orderupdate.length == 1) {
            await orderSchema.findOneAndUpdate({ _id: id }, { status: "Order Cancelled", isActive: false });
            res
                .status(200)
                .json({ Message: "Order Cancelled!", Data: 1, IsSuccess: true });
        } {
            res.status(200).json({
                Message: "Unable to Cancell Order!",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//list of couriers boys
router.post("/couriers", async function (req, res, next) {
    try {
        courierSchema
            .find({})
            .exec()
            .then((docs) => {
                if (docs.length != 0) {
                    res
                        .status(200)
                        .json({ Message: "Courier Found!", Data: docs, IsSuccess: true });
                } else {
                    res.status(200).json({
                        Message: "No Courier Found!",
                        Data: docs,
                        IsSuccess: true,
                    });
                }
            });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//toggle account approval of courier boys
router.post("/couriersIsApproval", async function (req, res, next) {
    const id = req.body.id;
    try {
        let courierApp = await courierSchema.find({ _id: id });
        if (courierApp.length == 1) {
            if (courierApp[0].accStatus.flag == true) {
                await courierSchema.findByIdAndUpdate(id, {
                    "accStatus.flag": false,
                    "accStatus.message": "Waiting For Administrator Approval",
                });
                res.status(200).json({
                    Message: "Account Status Updated!",
                    Data: 1,
                    IsSuccess: true,
                });
            } else {
                await courierSchema.findByIdAndUpdate(id, {
                    "accStatus.flag": true,
                    "accStatus.message": "Approved",
                });
                res.status(200).json({
                    Message: "Account Status Updated!",
                    Data: 1,
                    IsSuccess: true,
                });
            }
        } else {
            res.status(200).json({
                Message: "Account Status Not Updated!",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//toggle account status accessibility of courier boys
router.post("/couriersIsActive", async function (req, res, next) {
    const id = req.body.id;
    try {
        let courierApp = await courierSchema.find({ _id: id });
        if (courierApp.length == 1) {
            if (courierApp[0].isActive == true) {
                await courierSchema.findByIdAndUpdate(id, { isActive: false });
                res.status(200).json({
                    Message: "Account Status Updated!",
                    Data: 1,
                    IsSuccess: true,
                });
            } else {
                await courierSchema.findByIdAndUpdate(id, { isActive: true });
                res.status(200).json({
                    Message: "Account Status Updated!",
                    Data: 1,
                    IsSuccess: true,
                });
            }
        } else {
            res.status(200).json({
                Message: "Account Status Not Updated!",
                Data: 0,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//delete courier boys with their images and documents
router.post("/couriersDelete", async function (req, res, next) {
    const id = req.body.id;
    try {
        let data = await courierSchema.find({ _id: id });
        if (data.length === 1) {
            //Removing Uploaded Files
            var old = data[0].profileImg;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }
            old = data[0].poaFrontImg;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }
            old = data[0].poaBackImg;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }
            old = data[0].panCardImg;
            if (fs.existsSync(old.replace("\\g", "/"))) {
                fs.unlinkSync(old.replace("\\g", "/"));
            }

            await courierSchema.findByIdAndDelete(id);
            res
                .status(200)
                .json({ Message: "Account Not Deleted!", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Account Not Deleted!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//get live location of courier boys whose duty is on: used in dashboard adminpanel
router.post("/getLiveLocation", async function (req, res, next) {
    var list_courier = [];
    var listIds = await courierSchema
        .find({ isActive: true, "accStatus.flag": true, isVerified: true })
        .select("id firstName lastName");
    var counter = 0;
    for (let i = 0; i < listIds.length; i++) {
        let location = await currentLocation(listIds[i].id);
        console.log(location);
        if (location != null && location.duty == "ON") {
            counter++;
            let name = listIds[i].firstName + " " + listIds[i].lastName;
            let lat = Number(location.latitude);
            let long = Number(location.longitude);
            var data = [name, lat, long, counter];
            list_courier.push(data);
            console.log(data);
        }
    }
    res.status(200).json(list_courier);
});

//get todays extra kilometers done by courier boys during orders
router.post("/todaysExtraKms", async function (req, res, next) {
    try {
        var dataList = [];
        let currentdate = new Date().toISOString().slice(0, 10);
        let exttime = await ExtatimeSchema.find({})
            .populate("courierId")
            .populate({
                path: "orderId",
                populate: {
                    path: "customerId",
                    model: "Customers",
                },
            });
        for (let i = 0; i < exttime.length; i++) {
            if (exttime[i].dateTime.toISOString().slice(0, 10) == currentdate) {
                dataList.push(exttime[i]);
            }
        }
        if (dataList.length != 0) {
            res
                .status(200)
                .json({ Message: "Data Found!", Data: dataList, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Data Not Found!", Data: dataList, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//get todays extra kilometers done by courier boys during orders
router.post("/appstatistics", async function (req, res, next) {
    const courierId = req.body.courierId;
    try {
        var dataList = [];
        let currentdate = new Date().toISOString().slice(0, 10);
        let exttime = await ExtatimeSchema.find({ courierId: courierId }).populate({
            path: "orderId",
            populate: {
                path: "customerId",
                model: "Customers",
            },
        });
        for (let i = 0; i < exttime.length; i++) {
            if (exttime[i].dateTime.toISOString().slice(0, 10) == currentdate) {
                if (exttime[i].orderId.status == "Order Delivered") {
                    let pickup = {
                        latitude: exttime[i].orderId.pickupPoint.lat,
                        longitude: exttime[i].orderId.pickupPoint.long,
                    };
                    let drop = {
                        latitude: exttime[i].orderId.deliveryPoint.lat,
                        longitude: exttime[i].orderId.deliveryPoint.long,
                    };
                    let pndKM = await GoogleMatrix(pickup, drop);

                    let start = {
                        latitude: exttime[i].blat,
                        longitude: exttime[i].blong,
                    };
                    let end = { latitude: exttime[i].plat, longitude: exttime[i].plong };
                    let extaKM = await GoogleMatrix(start, end);
                    dataList.push({
                        courierId: exttime[i].courierId,
                        orderNo: exttime[i].orderId.orderNo,
                        pndKM: pndKM.toFixed(2),
                        extaKM: extaKM.toFixed(2),
                    });
                }
            }
        }
        if (dataList.length != 0) {
            res
                .status(200)
                .json({ Message: "Data Found!", Data: dataList, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Data Not Found!", Data: dataList, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//get extra kilometers done by courier boys during orders from date wise
router.post("/ftExtraKms", async function (req, res, next) {
    const { FromDate, ToDate } = req.body;
    let fdate = new Date(FromDate);
    let tdate = new Date(ToDate);
    console.log(fdate);
    console.log(tdate);
    try {
        let exttime = await ExtatimeSchema.find({
            dateTime: {
                $gte: fdate,
                $lt: tdate,
            },
        })
            .populate("courierId")
            .populate({
                path: "orderId",
                populate: {
                    path: "customerId",
                    model: "Customers",
                },
            });

        if (exttime.length != 0) {
            res
                .status(200)
                .json({ Message: "Data Found!", Data: exttime, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Data Not Found!", Data: exttime, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//change Admin Password : Account Settings
router.post("/changePassword", async function (req, res, next) {
    const { userId, accountname, oldpassword, newpassword } = req.body;
    try {
        let dataset = await adminSchema.find({
            _id: userId,
            password: oldpassword,
        });
        if (dataset.length == 1) {
            await adminSchema.findByIdAndUpdate(userId, {
                name: accountname,
                password: newpassword,
            });
            res
                .status(200)
                .json({ Message: "Password Updated!", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Password Not Updated!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//get delivery Boys whose duty is on
router.post("/getAvailableBoys", async function (req, res, next) {
    try {
        var list_courier = [];

        var listIds = await courierSchema
            .find({ isActive: true, "accStatus.flag": true, isVerified: true })
            .select("id firstName lastName");

        for (let i = 0; i < listIds.length; i++) {
            let location = await currentLocation(listIds[i].id);
            if (location != null && location.duty == "ON") {
                let dbID = listIds[i].id;
                let name = listIds[i].firstName + " " + listIds[i].lastName;
                list_courier.push({
                    Id: dbID,
                    name: name,
                });
            }
        }

        res.status(200).json({
            Message: "Delivery Boys Found!",
            Data: list_courier,
            IsSuccess: true,
        });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/AssignOrder", async function (req, res, next) {
    const { courierId, orderId } = req.body;
    try {
        let OrderData = await orderSchema.find({ _id: orderId, isActive: true });
        let courierboy = await courierSchema.find({ _id: courierId });
        if (OrderData.length == 1) {
            let location = await currentLocation(courierId);
            let pick = {
                latitude: OrderData[0].pickupPoint.lat,
                longitude: OrderData[0].pickupPoint.long,
            };
            let emplocation = {
                latitude: location.latitude,
                longitude: location.longitude,
            };
            let distanceKM = await GoogleMatrix(emplocation, pick);

            var newrequest = new requestSchema({
                _id: new config.mongoose.Types.ObjectId(),
                courierId: courierId,
                orderId: orderId,
                distance: distanceKM,
                status: "Accept",
                reason: "",
                fcmToken: courierboy[0].fcmToken,
            });
            await newrequest.save();

            await orderSchema.findByIdAndUpdate(orderId, {
                courierId: courierId,
                status: "Order Assigned",
                note: "Order Has Been Assigned",
            });
            let description =
                courierboy[0].cId +
                " Accepted Order " +
                OrderData[0].orderNo +
                " Assigned By Admin";
            let logger = new locationLoggerSchema({
                _id: new config.mongoose.Types.ObjectId(),
                courierId: courierId,
                lat: location.latitude,
                long: location.longitude,
                description: description,
            });
            await logger.save();

            //send Notificaiton Code Here To Customer
            //send sms when directly assign SMS
            //kd 30-08-2020
            let courierData = await courierSchema.find({ _id: courierId });
            //send Message to customer
            let createMsg =
                "Your order " +
                OrderData[0].orderNo +
                " has been accepted by our delivery boy " +
                courierData[0].firstName +
                " " +
                courierData[0].lastName +
                "--" +
                courierData[0].mobileNo +
                ".He Will Reach To You Shortly.";
            console.log(courierData[0].mobileNo + createMsg);
            sendMessages(OrderData[0].pickupPoint.mobileNo, createMsg);

            // New Code 03-09-2020
            var payload = {
                "title": "Order Alert",
                "body": "New Order Alert Found For You.",
                "data": {
                    "sound": "surprise.mp3",
                    "orderid": orderId,
                    "distance": distanceKM,
                    "click_action": "FLUTTER_NOTIFICATION_CLICK"
                },
                "to": courierboy[0].fcmToken
            };
            var options = {
                'method': 'POST',
                'url': 'https://fcm.googleapis.com/fcm/send',
                'headers': {
                    'authorization': 'key=AAAAb8BaOXA:APA91bGPf4oQWUscZcjXnuyIJhEQ_bcb6pifUozs9mjrEyNWJcyut7zudpYLBtXGGDU4uopV8dnIjCOyapZToJ1QxPZVBDBSbhP_wxhriQ7kFBlHN1_HVTRtClUla0XSKGVreSgsbgjH',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            };
            request(options, function (error, response) {
                if (error) {
                    console.log(error.message);
                } else {
                    console.log("Sending Notification");
                    console.log(response.body);
                }
            });

            res
                .status(200)
                .json({ Message: "Order Assigned !", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Order Not Assigned!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});
// send sms
async function sendMessages(mobileNo, message) {
    // let msgportal =
    //     "http://promosms.itfuturz.com/vendorsms/pushsms.aspx?user=" +
    //     process.env.SMS_USER +
    //     "&password=" +
    //     process.env.SMS_PASS +
    //     "&msisdn=" +
    //     mobileNo +
    //     "&sid=" +
    //     process.env.SMS_SID +
    //     "&msg=" +
    //     message +
    //     "&fl=0&gwid=2";
    let msgportal = "http://websms.mitechsolution.com/api/push.json?apikey=" + process.env.SMS_API + "&route=vtrans&sender=PNDDEL&mobileno=" + mobileNo + "&text= " + message;
    console.log(msgportal);
    axios.get(msgportal);
    var data = await axios.get(msgportal);
    return data;
}
router.post(
    "/policeverification",
    uploadpoliceImg.single("image"),
    async function (req, res, next) {
        const id = req.body.id;
        try {
            const file = req.file;
            if (file != undefined) {
                let updatedata = {
                    policeVerificationImg: file.path,
                };
                await courierSchema.findByIdAndUpdate(id, updatedata);
            }
            res.json({ Message: "Police Verified !", Data: 1, IsSuccess: true });
        } catch (err) {
            res.json({ Message: err.message, Data: 0, IsSuccess: false });
        }
    }
);

//Prmocode Management
router.post("/addpromocode", uploadpromocode.single("image"), async function (
    req,
    res,
    next
) {
    const {
        id,
        title,
        description,
        code,
        discount,
        validfrom,
        validupto,
    } = req.body;
    const file = req.file;
    try {
        if (id == 0) {
            let newPromo = new promocodeSchema({
                _id: new config.mongoose.Types.ObjectId(),
                title: title,
                description: description,
                code: code,
                discount: discount,
                validfrom: validfrom,
                validupto: validupto,
                image: file != undefined ? file.path : "",
            });
            await newPromo.save();
        } else {
            let dataset = await promocodeSchema.find({ _id: id });
            if (dataset.length == 1) {
                if (file != undefined) {
                    let newPromo = {
                        title: title,
                        description: description,
                        code: code,
                        discount: discount,
                        validfrom: validfrom,
                        validupto: validupto,
                        image: file.path,
                    };
                    await promocodeSchema.findByIdAndUpdate(id, newPromo);
                } else {
                    let newPromo = {
                        title: title,
                        description: description,
                        code: code,
                        discount: discount,
                        validfrom: validfrom,
                        validupto: validupto,
                    };
                    await promocodeSchema.findByIdAndUpdate(id, newPromo);
                }
            }
        }
        res
            .status(200)
            .json({ Message: "Promocode Added!", Data: 1, IsSuccess: true });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/promocodes", async function (req, res, next) {
    try {
        let dataset = await promocodeSchema.find({});
        res
            .status(200)
            .json({ Message: "Promocode List!", Data: dataset, IsSuccess: true });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/deletepromocode", async function (req, res, next) {
    const { id } = req.body;
    try {
        let dataset = await promocodeSchema.findByIdAndDelete(id);
        if (dataset != null) {
            res
                .status(200)
                .json({ Message: "Promocode List!", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Promocode List!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//Banner Management
router.post("/addbanner", uploadbanner.single("image"), async function (
    req,
    res,
    next
) {
    const { title, type } = req.body;
    try {
        const file = req.file;
        let newbanner = new bannerSchema({
            _id: new config.mongoose.Types.ObjectId(),
            title: title,
            type: type,
            image: file == undefined ? null : file.path,
        });
        await newbanner.save();
        res
            .status(200)
            .json({ Message: "Banner Added!", Data: 1, IsSuccess: true });
    } catch (err) {
        res.json({
            Message: err.message,
            Data: 0,
            IsdSuccess: false,
        });
    }
});

router.post("/banners", async function (req, res, next) {
    try {
        let dataset = await bannerSchema.find();
        res
            .status(200)
            .json({ Message: "Banner Found!", Data: dataset, IsSuccess: true });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/deletebanner", async function (req, res, next) {
    const id = req.body.id;
    try {
        let dataset = await bannerSchema.find({ _id: id });
        if (dataset.length == 1) {
            let data = await bannerSchema.findByIdAndDelete(id);
            if (data != null) {
                var old = dataset[0].image;
                if (fs.existsSync(old.replace("\\g", "/"))) {
                    fs.unlinkSync(old.replace("\\g", "/"));
                }
                res
                    .status(200)
                    .json({ Message: "Banner Deleted!", Data: 1, IsSuccess: true });
            } else {
                res
                    .status(200)
                    .json({ Message: "Banner Not Deleted!", Data: 0, IsSuccess: true });
            }
        } else {
            res
                .status(200)
                .json({ Message: "Banner Not Deleted!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//Message Creator
router.post("/messages", async function (req, res, next) {
    try {
        let dataset = await messageSchema.find({});
        res
            .status(200)
            .json({ Message: "Messages Fetched!", Data: dataset, IsSuccess: true });
    } catch (err) {
        res.json({
            Message: err.message,
            Data: 0,
            IsSuccess: false,
        });
    }
});

router.post("/addMessage", async function (req, res, next) {
    const { id, title, description } = req.body;
    try {
        if (id == 0) {
            let newMessage = new messageSchema({
                _id: new config.mongoose.Types.ObjectId(),
                title: title,
                description: description,
            });
            await newMessage.save();
            res.status(200).json({
                Message: "Message Saved!",
                Data: 1,
                IsSuccess: true,
            });
        } else {
            let oldMessage = {
                title: title,
                description: description,
            };
            await messageSchema.findByIdAndUpdate(id, oldMessage);
            res.status(200).json({
                Message: "Message Edited!",
                Data: 1,
                IsSuccess: true,
            });
        }
    } catch (err) {
        res.json({
            Message: err.message,
            Data: 0,
            IsSuccess: false,
        });
    }
});

router.post("/deleteMessage", async function (req, res, next) {
    const id = req.body.id;
    try {
        let dataset = await messageSchema.findByIdAndDelete(id);
        if (dataset != null) {
            res
                .status(200)
                .json({ Message: "Message Deleted!", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Message Not Deleted!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//coustomer
router.post("/customers", async function (req, res, next) {
    try {
        let dataset = await customerSchema.find({});
        res.status(200).json({
            Message: "Customer List Found!",
            Data: dataset,
            IsSuccess: true,
        });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/customersDelete", async function (req, res, next) {
    const id = req.body.id;
    try {
        let dataset = await customerSchema.findByIdAndDelete(id);
        if (dataset != null) {
            res
                .status(200)
                .json({ Message: "Customer Deleted!", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Customer Not Deleted!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//Location Logs
router.post("/courierlogs", async function (req, res, next) {
    try {
        let dataset = await locationLoggerSchema
            .find({})
            .populate("courierId")
            .sort({ dateTime: -1 });
        res.status(200).json({
            Message: "Log List Found!",
            Data: dataset,
            IsSuccess: true,
        });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//send Notification to PND Delivery Boys
router.post("/sendNToPND", async function (req, res, next) {
    try {
        const { service, data, title, message } = req.body;
        let payload = {
            notification: {
                title: title,
                body: message,
            },
            data: { type: "message", click_action: "FLUTTER_NOTIFICATION_CLICK" },
        };
        let options = { priority: "high", timeToLive: 60 * 60 * 24 };

        if (service.length == 2) {
            for (let i = 0; i < data.length; i++) {
                let messag = title + "," + message;
                // let msgportal =
                //     "http://promosms.itfuturz.com/vendorsms/pushsms.aspx?user=" +
                //     process.env.SMS_USER +
                //     "&password=" +
                //     process.env.SMS_PASS +
                //     "&msisdn=" +
                //     data[i].mobileNo +
                //     "&sid=" +
                //     process.env.SMS_SID +
                //     "&msg=" +
                //     messag +
                //     "&fl=0&gwid=2";

                let msgportal = "http://websms.mitechsolution.com/api/push.json?apikey=" + process.env.SMS_API + "&route=vtrans&sender=PNDDEL&mobileno=" + data[i].mobileNo + "&text= " + messag;
                console.log(msgportal);
                axios.get(msgportal);
            }

            for (let i = 0; i < data.length; i++) {
                config.firebase
                    .messaging()
                    .sendToDevice(data[i].fcmToken, payload, options)
                    .then((doc) => {
                        console.log("Sending Notification");
                        console.log(doc);
                    });
            }
        } else if (service[0].Name == "SMS") {
            let list = data.length;
            console.log(list);
            for (let i = 0; i < list; i++) {
                let messag = title + "," + message;
                let msgportal = "http://websms.mitechsolution.com/api/push.json?apikey=" + process.env.SMS_API + "&route=vtrans&sender=PNDDEL&mobileno=" + data[i].mobileNo + "&text= " + messag;
                //let msgportal = "http://promosms.itfuturz.com/vendorsms/pushsms.aspx?user=" + process.env.SMS_USER + "&password=" + process.env.SMS_PASS + "&msisdn=" + data[i].mobileNo + "&sid=" + process.env.SMS_SID + "&msg=" + messag + "&fl=0&gwid=2";
                axios.get(msgportal);
            }

        } else if (service[0].Name == "NOTIFICATION") {
            for (let i = 0; i < data.length; i++) {
                config.firebase
                    .messaging()
                    .sendToDevice(data[i].fcmToken, payload, options)
                    .then((doc) => {
                        console.log("Sending Notification");
                        console.log(doc);
                    });
            }
        }
        res.json({
            Message: "Notification Sent Successfull!",
            Data: 1,
            IsSuccess: true,
        });
    } catch (err) {
        res.json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});
//check balance
//http://websms.mitechsolution.com/api/creditstatus.json?apikey=5f266fc48b29f
router.post("/balancecheck", async (req, res, next) => {
    let data = await axios.get("http://websms.mitechsolution.com/api/creditstatus.json?apikey=" + process.env.SMS_API);
    res.json(data.data.description);
})
//not to show on admin panel
router.post("/adddeliverytype", async (req, res, next) => {
    const { title, weightlimit, cost } = req.body;
    try {
        let predata = new deliverytypesSchema({
            _id: new config.mongoose.Types.ObjectId(),
            title: title,
            weightlimit: weightlimit,
            cost: cost,
        });
        predata.save();
        res.status(200).json("Data Saved");
    } catch (err) {
        res.status(500).json(err.message);
    }
});

router.post("/deliverytype", async (req, res, next) => {
    try {
        let predata = await deliverytypesSchema.find({});
        res.status(200).json(predata);
    } catch (err) {
        res.status(500).json(err.message);
    }
});

router.post("/addpoatype", async (req, res, next) => {
    const title = req.body.title;
    try {
        let data = new poatypesSchema({
            _id: new config.mongoose.Types.ObjectId(),
            title: title,
        });
        data.save();
        res.status(200).json("Data Saved");
    } catch (err) {
        res.status(500).json(err.message);
    }
});

router.post("/poatypes", async (req, res, next) => {
    try {
        let predata = await poatypesSchema.find({});
        res.status(200).json(predata);
    } catch (err) {
        res.status(500).json(err.message);
    }
});

router.post(
    "/addcategories",
    uploadcategory.single("image"),
    async (req, res, next) => {
        const id = req.body.id;
        const title = req.body.title;
        const price = req.body.price;
        const note = req.body.note;
        try {
            const file = req.file;
            if (id == "0") {
                let category = new parcelcategories({
                    _id: new config.mongoose.Types.ObjectId(),
                    title: title,
                    price: price,
                    note: note,
                    image: file == undefined ? null : file.path,
                });
                await category.save();
                res.json({
                    Message: "Category Added Successfully!",
                    Data: 1,
                    IsSuccess: true,
                });
            } else {
                if (file != undefined) {
                    let category = {
                        title: title,
                        price: price,
                        note: note,
                        image: file == undefined ? null : file.path,
                    };
                    await parcelcategories.findByIdAndUpdate(id, category, { new: true });
                    res.json({
                        Message: "Category Updated Successfully!",
                        Data: 1,
                        IsSuccess: true,
                    });
                } else {
                    let category = {
                        title: title,
                        price: price,
                        note: note,
                    };
                    await parcelcategories.findByIdAndUpdate(id, category, { new: true });
                    res.json({
                        Message: "Category Updated Successfully!",
                        Data: 1,
                        IsSuccess: true,
                    });
                }
            }
        } catch (err) {
            res.json({
                Message: err.message,
                Data: 0,
                IsSuccess: false,
            });
        }
    }
);

router.post("/deletecategory", async function (req, res, next) {
    const id = req.body.id;
    try {
        let dataset = await parcelcategories.findByIdAndDelete(id);
        if (dataset != null) {
            res
                .status(200)
                .json({ Message: "Customer Deleted!", Data: 1, IsSuccess: true });
        } else {
            res
                .status(200)
                .json({ Message: "Customer Not Deleted!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/category", async (req, res, next) => {
    try {
        let datalist = await parcelcategories.find({});
        res.json({
            Message: "Categiories Found!",
            Data: datalist,
            IsSuccess: true,
        });
    } catch (err) {
        res.json({
            Message: err.message,
            Data: 0,
            IsSuccess: false,
        });
    }
});

router.post("/getextrakms", async (req, res, next) => {
    try {
        var fromDate = req.body.fromDate;
        var toDate = req.body.toDate;
        var couriersList = [];

        if (fromDate != "" && fromDate != null && toDate != "" && toDate != null) {
            fromDate = new Date(fromDate);
            toDate = new Date(toDate);
        } else {
            let date = new Date().toISOString().split("T")[0];
            let currentdate = new Date(date);
            fromDate = new Date(date);
            toDate = new Date(currentdate.setDate(currentdate.getDate() + 1));
        }

        console.log(fromDate);
        console.log(toDate);

        let settings = await settingsSchema.find({}).select("AmountPayKM");
        let verifiedcouriers = await courierSchema.find({});
        for (let i = 0; i < verifiedcouriers.length; i++) {
            let exttime = await ExtatimeSchema.find({
                dateTime: { $gte: fromDate, $lt: toDate },
                plat: { $ne: null },
                courierId: verifiedcouriers[i]._id,
            }).populate("orderId");
            console.log(exttime);

            let finalpddistance = 0;
            let finalearning = 0;
            let orderData = [];
            let blank = 0;

            for (let i = 0; i < exttime.length; i++) {
                let start = { latitude: exttime[i].blat, longitude: exttime[i].blong };
                let end = { latitude: exttime[i].plat, longitude: exttime[i].plong };
                let distance = await GoogleMatrix(start, end);

                blank = blank + distance;
                let orderdistance = exttime[i].orderId.deliveryPoint.distance;
                finalpddistance = finalpddistance + orderdistance;

                finalearning = finalearning + exttime[i].orderId.finalAmount;
                let ordData = {
                    extrakm: {
                        start: start,
                        end: end,
                    },
                    extratime: distance,
                    orderData: exttime[i].orderId,
                };
                orderData.push(ordData);
            }

            let total = Number(finalpddistance) + Number(blank);
            couriersList.push({
                id: verifiedcouriers[i]._id,
                orderdata: orderData,
                name: verifiedcouriers[i].firstName + " " + verifiedcouriers[i].lastName,
                extrakm: blank.toFixed(2),
                orderkm: finalpddistance.toFixed(2),
                totaldist: total.toFixed(2),
                totalearning: finalearning.toFixed(2),
                amttopay: total.toFixed(2) * Number(settings[0].AmountPayKM),
            });
        }
        res
            .status(200)
            .json({ Message: "Data Found!", Data: couriersList, IsSuccess: true });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/addprooftype", async (req, res, next) => {
    const title = req.body.title;
    try {
        let category = new prooftypeSchema({
            _id: new config.mongoose.Types.ObjectId(),
            title: title,
        });
        category.save();
        res.json({
            Message: "Proff Added Successfully!",
            Data: 1,
            IsSuccess: true,
        });
    } catch (err) {
        res.json({
            Message: err.message,
            Data: 0,
            IsSuccess: false,
        });
    }
});

//Add Custome Reasons for canceling Orders
router.post("/ordercancelreason", async function(req, res, next){
    if(isEmpty(req.body)){
        res.status(404).send("404 ERROR");
      }
      else{
        var record = new orderCancelSchema({
            DefaultReason : req.body.DefaultReason,
            CustomeReason : req.body.CustomeReason  
        });
        console.log(record);
        record.save();
        return res.status(200).send({success: true, Message : "Your Reasons Added"});
      }
});

//Get All Reasons
router.post("/getordercancelreason", async function(req , res , next){
    try {
        let Reasons = await orderCancelSchema.find()
        res.status(200).json({ Success : true , Message : "Data Found" , Data : Reasons });    
    } catch (err) {
        res.status(400).json({ Success : false , Message : "Data Not Found" })
    }

});

router.post("/getdateorder", async function(req, res, next){
    let { startDate , endDate ,empId } = req.body;

    try {
        // if(startDate === '' || endDate === '') {
        //     return res.status(400).json({
        //         status:'failure',
        //         message: 'Please ensure you pick two dates'
        //          })
        //         }
        console.log({ startDate, endDate});
        let dataset = await orderSchema.find( { "courierId" : empId , dateTime:{$gte:startDate,$lte:endDate}} )
        .populate(
            "courierId",
            "firstName lastName fcmToken mobileNo accStatus transport isVerified"
        )
        .populate("customerId");
        res.status(200).json({ Success : true , Message : "Data Found" , CountOrder : dataset.length , Data : dataset })
    } catch (err) {
        res.status(400).json({ Success : false , Message : "Data Not Found" })
    }
});

// router.post("getempordercount/:id",async function(req, res, next){
//     var empId = req.params.id;
//     try {
//         let newdataset = [];

//         let empOrders = await orderSchema
//             .find()
//             .populate(
//                 { courierId : empId }
//             )
//             .populate("customerId");
//         res.status(200).json({ Success : true , Message : "Data Found" , Data : empOrders })
//     } catch (err) {
//         res.status(400).json({ Success : false , Message : "Data Not Found" })
//     }
// });

router.post('/apiOrder', async function(req,res,next){
    const { name , address , building , ghari , mobileNo , dateTime , qty250 , qty500 , qty1000 , date , time} = req.body;
    var order_date = moment()
                .tz("Asia/Calcutta")
                .format("DD MM YYYY, h:mm:ss a")
                .split(",")[0];
    var order_time = moment()
                .tz("Asia/Calcutta")
                .format("DD MM YYYY, h:mm:ss a")
                .split(",")[1];

    // var parts = order_date.split(' ');
    // var newDateIs = new Date(parts[2], parts[1] - 1, parts[0]); 
    // console.log(newDateIs);
    
    try {
        let sumulOrderDetails = await new sumulOrderSchema({
            name : name,
            address : address,
            mobileNo : mobileNo,
            dateTime : dateTime,
            qty250 : qty250,
            qty500 : qty500,
            qty1000 : qty1000,
            building : building,
            date: order_date,
            time: order_time
        });
        let data = await sumulOrderDetails.save();
        console.log(data);
        res.status(200).json({ IsSuccess : true , Message : "Order Added...!!!" , Data : data });
    } catch (error) {
        res.status(500).json({ IsSuccess : false , Message : "Something Wrong" });
    }
});

router.post('/getapiorder', async function(req , res , next){
    try {
        let sumulordersList = await sumulOrderSchema.find();
        console.log(sumulordersList);
        res.status(200).json({ IsSuccess : true , Message : "Orders List Found...!!!" , Data : sumulordersList});
    } catch (error) {
        res.status(500).json({ IsSuccess : false , Message : "Order List Not Found...!!!" });
    }
});

module.exports = router;
