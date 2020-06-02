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
const { getDistance, convertDistance } = require("geolib");

var bannerlocation = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, "uploads/banners");
    },
    filename: function(req, file, cb) {
        cb(
            null,
            file.fieldname + "_" + Date.now() + path.extname(file.originalname)
        );
    },
});
var uploadbanner = multer({ storage: bannerlocation });

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

async function currentLocation(id) {
    var CourierRef = config.docref.child(id);
    const data = await CourierRef.once("value")
        .then((snapshot) => snapshot.val())
        .catch((err) => err);
    return data;
}

//create adminpanel accounts
router.post("/signup", async function(req, res, next) {
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
router.post("/login", async function(req, res, next) {
    const { username, password, type } = req.body;
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
router.post("/dashcounters", async function(req, res, next) {
    try {
        let admins = await adminSchema.countDocuments();
        let couriers = await courierSchema.countDocuments();
        let totalOrders = await orderSchema.countDocuments();
        let customers = await customerSchema.countDocuments();
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
        });
        res
            .status(200)
            .json({ Message: "Counters Found!", Data: datalist, IsSuccess: true });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//get verfied couriers for admin panel map
router.post("/getVerifiedCouriers", async function(req, res, next) {
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
router.post("/adminusers", async function(req, res, next) {
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
router.post("/updatesetttings", async function(req, res, next) {
    const {
        PerUnder5KM,
        PerKM,
        ExpDelivery,
        ReferalPoint,
        WhatsAppNo,
        DefaultWMessage,
        AppLink,
    } = req.body;
    try {
        var existData = await settingsSchema.find({});
        if (existData.length == 1) {
            let id = existData[0].id;
            let updatedsettings = {
                PerUnder5KM: PerUnder5KM,
                PerKM: PerKM,
                ExpDelivery: ExpDelivery,
                ReferalPoint: ReferalPoint,
                WhatsAppNo: WhatsAppNo,
                DefaultWMessage: DefaultWMessage,
                AppLink: AppLink,
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
                ExpDelivery: ExpDelivery,
                ReferalPoint: ReferalPoint,
                WhatsAppNo: WhatsAppNo,
                DefaultWMessage: DefaultWMessage,
                AppLink: AppLink,
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
router.post("/settings", async function(req, res, next) {
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
router.post("/orders", async function(req, res, next) {
    try {
        let newdataset = [];

        let cancelledOrders = await orderSchema
            .find({ status: "Order Cancelled", isActive: false })
            .populate(
                "courierId",
                "firstName lastName fcmToken mobileNo accStatus transport isVerified"
            )
            .populate("customerId");

        let pendingOrders = await orderSchema
            .find({ status: "Admin" })
            .populate(
                "courierId",
                "firstName lastName fcmToken mobileNo accStatus transport isVerified"
            )
            .populate("customerId");

        let runningOrders = await orderSchema
            .find({ $or: [{ status: "Finding" }, { status: "Scheduled" }, { status: "Order Picked" }, { status: "Order Assigned" }] })
            .populate(
                "courierId",
                "firstName lastName fcmToken mobileNo accStatus transport isVerified"
            )
            .populate("customerId");

        let completeOrders = await orderSchema
            .find({ status: "Order Delivered", isActive: false })
            .populate(
                "courierId",
                "firstName lastName fcmToken mobileNo accStatus transport isVerified"
            )
            .populate("customerId");

        newdataset.push({
            runningOrders: runningOrders,
            cancelledOrders: cancelledOrders,
            pendingOrders: pendingOrders,
            completeOrders: completeOrders
        });

        res
            .status(200)
            .json({ Message: "Order Found!", Data: newdataset, IsSuccess: true });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//cancel Order
router.post("/cancelOrder", async function(req, res, next) {
    const id = req.body.id;
    try {
        let orderupdate = await orderSchema.find({ '_id': id, isActive: true });
        if (orderupdate.length == 1) {
            await orderSchema.findOneAndUpdate({ '_id': id }, { status: "Order Cancelled", isActive: false });
            res.status(200).json({ Message: "Order Cancelled!", Data: 1, IsSuccess: true });
        } {
            res.status(200).json({ Message: "Unable to Cancell Order!", Data: 0, IsSuccess: true });
        }
    } catch {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
})

//list of couriers boys
router.post("/couriers", async function(req, res, next) {
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
router.post("/couriersIsApproval", async function(req, res, next) {
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
router.post("/couriersIsActive", async function(req, res, next) {
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
router.post("/couriersDelete", async function(req, res, next) {
    const id = req.body.id;
    try {
        var data = await courierSchema.find({ _id: id });
        if (data.length == 1) {
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
router.post("/getLiveLocation", async function(req, res, next) {
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
router.post("/todaysExtraKms", async function(req, res, next) {
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

//get extra kilometers done by courier boys during orders from date wise
router.post("/ftExtraKms", async function(req, res, next) {
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
router.post("/changePassword", async function(req, res, next) {
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
router.post("/getAvailableBoys", async function(req, res, next) {
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

router.post("/AssignOrder", async function(req, res, next) {
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
            let distanceKM = convertDistance(
                getDistance(emplocation, pick, 1000),
                "km"
            );

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

            let locationfinder = location.latitude + "," + location.longitude;
            let description = orderId + " Assigned By Admin";
            let logger = new locationLoggerSchema({
                _id: new config.mongoose.Types.ObjectId(),
                courierId: courierId,
                latlong: locationfinder,
                description: description,
            });
            await logger.save();

            //send Notificaiton Code Here To Customer
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

//send sms & notfication
router.post("/notificationToCustomers", async function(req, res, next) {
    const { customerId, title, message, checkins } = req.body;
    try {
        res.json(req.body);
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//Prmocode Management
router.post("/addpromocode", async function(req, res, next) {
    const { id, title, description, code, discount, expiryDate } = req.body;
    try {
        if (id == 0) {
            let newPromo = new promocodeSchema({
                _id: new config.mongoose.Types.ObjectId(),
                title: title,
                description: description,
                code: code,
                discount: discount,
                expiryDate: expiryDate,
            });
            await newPromo.save();
        } else {
            let dataset = await promocodeSchema.find({ _id: id });
            if (dataset.length == 1) {
                let newPromo = {
                    title: title,
                    description: description,
                    code: code,
                    discount: discount,
                    expiryDate: expiryDate,
                };
                await promocodeSchema.findByIdAndUpdate(id, newPromo);
            }
        }
        res
            .status(200)
            .json({ Message: "Promocode Added!", Data: 1, IsSuccess: true });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/promocodes", async function(req, res, next) {
    try {
        let dataset = await promocodeSchema.find({});
        res
            .status(200)
            .json({ Message: "Promocode List!", Data: dataset, IsSuccess: true });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/deletepromocode", async function(req, res, next) {
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
router.post("/addbanner", uploadbanner.single("image"), async function(req, res, next) {
    const title = req.body.title;
    try {
        const file = req.file;
        let newbanner = new bannerSchema({
            _id: new config.mongoose.Types.ObjectId(),
            title: title,
            image: file == undefined ? null : file.path,
        });
        await newbanner.save();
        res.status(200).json({ Message: "Banner Added!", Data: 1, IsSuccess: true });
    } catch (err) {
        res.json({
            Message: err.message,
            Data: 0,
            IsSuccess: false,
        });
    }
});

router.post("/banners", async function(req, res, next) {
    try {
        let dataset = await bannerSchema.find();
        res.status(200).json({ Message: "Banner Found!", Data: dataset, IsSuccess: true });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/deletebanner", async function(req, res, next) {
    const id = req.body.id;
    try {
        let dataset = await bannerSchema.find({ '_id': id });
        if (dataset.length == 1) {
            let data = await bannerSchema.findByIdAndDelete(id);
            if (data != null) {
                var old = dataset[0].image;
                if (fs.existsSync(old.replace("\\g", "/"))) {
                    fs.unlinkSync(old.replace("\\g", "/"));
                }
                res.status(200).json({ Message: "Banner Deleted!", Data: 1, IsSuccess: true });
            } else {
                res.status(200).json({ Message: "Banner Not Deleted!", Data: 0, IsSuccess: true });
            }
        } else {
            res.status(200).json({ Message: "Banner Not Deleted!", Data: 0, IsSuccess: true });
        }
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

//Message Creator
router.post("/messages", async function(req, res, next) {
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

router.post("/addMessage", async function(req, res, next) {
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

router.post("/deleteMessage", async function(req, res, next) {
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
router.post("/customers", async function(req, res, next) {
    try {
        let dataset = await customerSchema.find({});
        res
            .status(200)
            .json({
                Message: "Customer List Found!",
                Data: dataset,
                IsSuccess: true,
            });
    } catch (err) {
        res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
    }
});

router.post("/customersDelete", async function(req, res, next) {
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

module.exports = router;