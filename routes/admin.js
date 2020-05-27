// Initiating Libraries
require("dotenv").config();
var path = require("path");
var fs = require("fs");
var axios = require("axios");
var express = require("express");
var config = require("../config");
var router = express.Router();
var cors = require("cors");

/* Data Models */
var adminSchema = require("../data_models/admin.signup.model");
var settingsSchema = require("../data_models/settings.model");
var orderSchema = require("../data_models/order.model");
var courierSchema = require("../data_models/courier.signup.model");
var ExtatimeSchema = require("../data_models/extratime.model");
var customerSchema = require("../data_models/customer.signup.model");

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
    let datalist = [];
    datalist.push({
      admins: admins,
      couriers: couriers,
      totalOrders: totalOrders,
      customers: customers,
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
    let dataset = await courierSchema.find({
      isActive: true,
      isVerified: true,
      "accStatus.flag": true,
    }).select("id cId firstName lastName");
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
  const { PerUnder5KM, PerKM, ExpDelivery, ReferalPoint } = req.body;
  try {
    var existData = await settingsSchema.find({});
    if (existData.length == 1) {
      let id = existData[0].id;
      let updatedsettings = {
        PerUnder5KM: PerUnder5KM,
        PerKM: PerKM,
        ExpDelivery: ExpDelivery,
        ReferalPoint: ReferalPoint,
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
    orderSchema
      .find({})
      .populate(
        "courierId",
        "firstName lastName fcmToken mobileNo accStatus transport isVerified"
      )
      .populate("customerId")
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
router.post("/getLiveLocation", async function (req, res, next) {
  var list_courier = [];
  var listIds = await courierSchema
    .find({ isActive: true, "accStatus.flag": true })
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

//send sms & notfication
router.post("/notificationToCustomers", async function (req, res, next) {
  const { customerId, title, message, checkins } = req.body;
  try {
    res.json(req.body);
  } catch (err) {
    res.status(500).json({ Message: err.message, Data: 0, IsSuccess: false });
  }
});

module.exports = router;
