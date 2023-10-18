const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
var serviceAccount = require("./key.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

const bp = require("body-parser");
const ph = require("password-hash");
const uniqId = require("uniqid");
const session = require("express-session");
const express = require("express");
const app = express();

app.set("view engine", "ejs");
app.use(bp.urlencoded({ extended: true }));
app.use(bp.json());
app.use(
  session({
    secret: "food donation app",
    resave: true,
    saveUninitialized: true,
  })
);

app.get("/", function (req, res) {
  res.render("intro");
});

app.get("/signup", function (req, res) {
  res.render("reg_home");
});

app.get("/orgRegister", function (req, res) {
  res.render("org_register", { sucState: false, errState: false });
});

app.get("/donRegister", function (req, res) {
  res.render("don_register", { sucState: false, errState: false });
});

app.get("/orglogin", function (req, res) {
  res.render("org_login", { errState: false });
});

app.get("/donlogin", function (req, res) {
  res.render("don_login", { errState: false });
});

app.post("/org_register_submit", function (req, res) {
  const email = req.body.email;
  const psw = req.body.psw;
  const c_psw = req.body.c_psw;
  db.collection("Organizations")
    .where("email", "==", email)
    .get()
    .then((docs) => {
      if (docs.size > 0) {
        res.render("org_register", {
          sucState: false,
          errState: true,
          errMsg: "Organization Already Exists.!",
        });
      } else {
        if (psw == c_psw) {
          db.collection("Organizations")
            .add({
              organization_name: req.body.organization_name,
              organization_id: req.body.org_id,
              owner_name: req.body.owner_name,
              email: email,
              password: ph.generate(psw),
              ph_no: req.body.phone_no,
              state: req.body.state,
              dist: req.body.district,
              city: req.body.city,
              street: req.body.street,
              pincode: req.body.pincode,
            })
            .then(() => {
              res.render("org_register", { sucState: true, errState: false });
            });
        } else {
          res.render("org_register", {
            sucState: false,
            errState: true,
            errMsg: "Pasword Doesn't Match.!",
          });
        }
      }
    });
  // console.log(req.body);
});

app.post("/don_register_submit", function (req, res) {
  const email = req.body.email;
  const psw = req.body.psw;
  const c_psw = req.body.c_psw;
  db.collection("Donors")
    .where("email", "==", email)
    .get()
    .then((docs) => {
      if (docs.size > 0) {
        res.render("don_register", {
          sucState: false,
          errState: true,
          errMsg: "Donor Already Exists.!",
        });
      } else {
        if (psw == c_psw) {
          db.collection("Donors")
            .add({
              Donor_name: req.body.user_name,
              email: email,
              password: ph.generate(psw),
              ph_no: req.body.phone_no,
              state: req.body.state,
              dist: req.body.district,
              city: req.body.city,
              street: req.body.street,
              pincode: req.body.pincode,
            })
            .then(() => {
              res.render("don_register", { sucState: true, errState: false });
            });
        } else {
          res.render("don_register", {
            sucState: false,
            errState: true,
            errMsg: "Pasword Doesn't Match.!",
          });
        }
      }
    });
});

app.post("/org_login_submit", async function (req, res) {
  const org_id = req.body.org_id;
  const email = req.body.email;
  const psw = req.body.psw;
  const orgdb = await db
    .collection("Organizations")
    .where("email", "==", email)
    .get();

  if (orgdb.size == 0) {
    res.render("org_login", {
      errState: true,
      errMsg: "Owner not Found.!",
    });
  } else {
    const userData = orgdb.docs[0].data();
    if (!ph.verify(psw, userData.password)) {
      // Incorrect password
      res.render("org_login", {
        errState: true,
        errMsg: "Incorrect password.!",
      });
    } else {
      if (org_id == userData.organization_id) {
        // Successful login
        req.session.orgEmail = email;
        const orgHisRef = orgdb.docs[0].ref
          .collection("Donation_History")
          .where("Status", "==", "Pending");
        const orgHis = await orgHisRef.get();
        const org_his_data = orgHis.docs.map((doc) => doc.data());
        res.render("org_home", {
          name: userData.organization_name,
          dataArr: { org_his_data },
        });
      } else {
        //incorrect org id
        res.render("org_login", {
          errState: true,
          errMsg: "Organization not Found.!",
        });
      }
    }
  }
});

app.post("/don_login_submit", function (req, res) {
  const email = req.body.email;
  const psw = req.body.psw;
  db.collection("Donors")
    .where("email", "==", email)
    .get()
    .then((docs) => {
      if (docs.size == 0) {
        res.render("don_login", {
          errState: true,
          errMsg: "Donor not Found.!",
        });
      } else {
        const userData = docs.docs[0].data();
        if (!ph.verify(psw, userData.password)) {
          // Incorrect password
          res.render("don_login", {
            errState: true,
            errMsg: "Incorrect password.!",
          });
        } else {
          // Successful login
          req.session.userEmail = email;
          res.render("don_home", { name: userData.Donor_name });
        }
      }
    });
});

app.get("/donat_food", async function (req, res) {
  const organizationsSnapshot = await db.collection("Organizations").get();
  const org_data = organizationsSnapshot.docs.map((doc) => doc.data());

  const user_email = req.session.userEmail;
  // console.log(user_email);
  const don_data = await db
    .collection("Donors")
    .where("email", "==", user_email)
    .get();
  // console.log(don_data.docs[0].data());
  res.render("food_donate_form", {
    dataArr: { org_data },
    don_details: don_data.docs[0].data(),
  });
});

app.post("/donat_food_submit", async function (req, res) {
  const orderID = uniqId();
  const date = new Date();
  const user_email = req.session.userEmail;
  const don_data = db.collection("Donors").where("email", "==", user_email);
  const donSnapshot = await don_data.get();
  //
  const orgRef = db
    .collection("Organizations")
    .where("organization_name", "==", req.body.orgname);
  const orgSnapshot = await orgRef.get();
  const orgDoc = orgSnapshot.docs[0];
  const donationHistoryRef = orgDoc.ref.collection("Donation_History");
  await donationHistoryRef.add({
    OrderId: orderID,
    Status: "Pending",
    Date: date.getMonth() + "/" + date.getDate() + "/" + date.getFullYear(),
    Donor_name: donSnapshot.docs[0].data().Donor_name,
    Donor_ph_no: donSnapshot.docs[0].data().ph_no,
    Donor_email: donSnapshot.docs[0].data().email,
    Donation: req.body.Donation,
    Donor_address:
      donSnapshot.docs[0].data().street +
      "/" +
      donSnapshot.docs[0].data().city +
      "/" +
      donSnapshot.docs[0].data().dist +
      "/" +
      donSnapshot.docs[0].data().state +
      "/" +
      donSnapshot.docs[0].data().pincode,
    Items: req.body.item,
    EachItem_Qty: req.body.qty,
  });
  // console.log(req.body);

  const donDoc = donSnapshot.docs[0];
  const donHisRef = donDoc.ref.collection("Donation_History");
  await donHisRef.add({
    OrderId: orderID,
    Date: date.getMonth() + "/" + date.getDate() + "/" + date.getFullYear(),
    Donate_to: req.body.orgname,
    Donation: req.body.Donation,
    Organization_ph: orgDoc.data().ph_no,
    address:
      donSnapshot.docs[0].data().street +
      "/" +
      donSnapshot.docs[0].data().city +
      "/" +
      donSnapshot.docs[0].data().dist +
      "/" +
      donSnapshot.docs[0].data().state +
      "/" +
      donSnapshot.docs[0].data().pincode,
    Items: req.body.item,
    EachItem_Qty: req.body.qty,
    Status: "Pending",
  });
});

app.get("/donat_grocy", async function (req, res) {
  const organizationsSnapshot = await db.collection("Organizations").get();
  const org_data = organizationsSnapshot.docs.map((doc) => doc.data());

  const user_email = req.session.userEmail;
  const don_data = await db
    .collection("Donors")
    .where("email", "==", user_email)
    .get();
  res.render("grocery_donate_form", {
    dataArr: { org_data },
    don_details: don_data.docs[0].data(),
  });
});

app.post("/donat_grocery_submit", async function (req, res) {
  const orderID = uniqId();
  const date = new Date();
  const user_email = req.session.userEmail;
  const orgRef = db
    .collection("Organizations")
    .where("organization_name", "==", req.body.orgname);
  const orgSnapshot = await orgRef.get();
  const orgDoc = orgSnapshot.docs[0];
  const donationHistoryRef = orgDoc.ref.collection("Donation_History");

  const don_data = db.collection("Donors").where("email", "==", user_email);
  const donSnapshot = await don_data.get();

  await donationHistoryRef.add({
    OrderId: orderID,
    Status: "Pending",
    Date: date.getMonth() + "/" + date.getDate() + "/" + date.getFullYear(),
    Donor_name: donSnapshot.docs[0].data().Donor_name,
    Donor_ph_no: donSnapshot.docs[0].data().ph_no,
    Donor_email: donSnapshot.docs[0].data().email,
    Donation: req.body.Donation,
    Donor_address:
      donSnapshot.docs[0].data().street +
      "/" +
      donSnapshot.docs[0].data().city +
      "/" +
      donSnapshot.docs[0].data().dist +
      "/" +
      donSnapshot.docs[0].data().state +
      "/" +
      donSnapshot.docs[0].data().pincode,
    Items: req.body.item,
    EachItem_Qty: req.body.qty,
  });
  // console.log(req.body);

  const donDoc = donSnapshot.docs[0];
  const donHisRef = donDoc.ref.collection("Donation_History");
  await donHisRef.add({
    OrderId: orderID,
    Date: date.getMonth() + "/" + date.getDate() + "/" + date.getFullYear(),
    Donate_to: req.body.orgname,
    Donation: req.body.Donation,
    Organization_ph: orgDoc.data().ph_no,
    address:
      donSnapshot.docs[0].data().street +
      "/" +
      donSnapshot.docs[0].data().city +
      "/" +
      donSnapshot.docs[0].data().dist +
      "/" +
      donSnapshot.docs[0].data().state +
      "/" +
      donSnapshot.docs[0].data().pincode,
    Items: req.body.item,
    EachItem_Qty: req.body.qty,
    Status: "Pending",
  });
});

app.get("/don_history", async (req, res) => {
  const donor_email = req.session.userEmail;

  const donQuery = db.collection("Donors").where("email", "==", donor_email);
  const donSnapshot = await donQuery.get();
  const don_name = donSnapshot.docs[0].data().Donor_name;

  //"Donation_History" subcollection
  const donHistoryRef = donSnapshot.docs[0].ref.collection("Donation_History");
  const donData = await donHistoryRef.get();
  const don_his_data = donData.docs.map((doc) => doc.data());

  res.render("don_history", {
    name: don_name,
    dataArr: { don_his_data },
  });
});

app.get("/don_profile", async (req, res) => {
  const don_email = req.session.userEmail;

  // "Donors" collection to get donor data
  const donorQuery = db.collection("Donors").where("email", "==", don_email);
  const donorSnapshot = await donorQuery.get();
  const don_data = donorSnapshot.docs[0].data();

  //"Donation_History" subcollection
  const donHisRef = donorSnapshot.docs[0].ref.collection("Donation_History");
  const donHis = await donHisRef.get();
  const no_donations = donHis.size;
  res.render("don_profile", { don_data, no_donations });
});

app.get("/org_profile", async (req, res) => {
  const org_email = req.session.orgEmail;

  // "Organization" collection to get donor data
  const donorQuery = db
    .collection("Organizations")
    .where("email", "==", org_email);
  const donorSnapshot = await donorQuery.get();
  const org_data = donorSnapshot.docs[0].data();

  //"Donation_History" subcollection
  const donHisRef = donorSnapshot.docs[0].ref.collection("Donation_History");
  const donHis = await donHisRef.get();
  const no_donations = donHis.size;
  res.render("org_profile", { org_data, no_donations });
});

app.get("/don_home", (req, res) => {
  const don_email = req.session.userEmail;
  db.collection("Donors")
    .where("email", "==", don_email)
    .get()
    .then((docs) => {
      const name = docs.docs[0].data().Donor_name;
      res.render("don_home", { name });
    });
});

app.get("/org_home",async (req, res) => {
  const org_email = req.session.orgEmail;
  const orgdb = await db
    .collection("Organizations")
    .where("email", "==", org_email)
    .get();
  
  const orgData = orgdb.docs[0].data();
  const orgHisRef = orgdb.docs[0].ref.collection("Donation_History").where("Status", "==", "Pending");
  const orgHis = await orgHisRef.get();
  const org_his_data = orgHis.docs.map((doc) => doc.data());
  res.render("org_home", {
    name: orgData.organization_name,
    dataArr: { org_his_data },
  });
})

app.post("/donation_accept", async (req, res) => {
  const org_email = req.session.orgEmail;
  const donor_email = req.body.orderemail;
  const orderid = req.body.orderid;
  const time = req.body.time;

  const donorQuery = db
    .collection("Organizations")
    .where("email", "==", org_email);
  const donorSnapshot = await donorQuery.get();

  const donHisRef = donorSnapshot.docs[0].ref.collection("Donation_History");
  const donHis = await donHisRef.where("OrderId", "==", orderid).get();

  const donationDoc = donHis.docs[0];
  await donationDoc.ref.update({
    Status: "Accepted",
    time: time,
  });

  const donQuery = db.collection("Donors").where("email", "==", donor_email);
  const donSnapshot = await donQuery.get();

  //"Donation_History" subcollection
  const donHistoryRef = donSnapshot.docs[0].ref.collection("Donation_History");
  const donData = await donHistoryRef.where("OrderId", "==", orderid).get();

  const donDoc = donData.docs[0];
  await donDoc.ref.update({
    Status: "Accepted",
    time: time,
  });

  const orgdb = await db
    .collection("Organizations")
    .where("email", "==", org_email)
    .get();

  const orgHisRef = orgdb.docs[0].ref
    .collection("Donation_History")
    .where("Status", "==", "Pending");
  const orgHis = await orgHisRef.get();
  const org_his_data = orgHis.docs.map((doc) => doc.data());
  res.render("org_home", {
    name: orgdb.docs[0].data().organization_name,
    dataArr: { org_his_data },
  });
});

app.get("/org_history", async (req, res) => {
  const email = req.session.orgEmail;
  const orgdb = await db
    .collection("Organizations")
    .where("email", "==", email)
    .get();
  const userData = orgdb.docs[0].data();

  const orgHisRef = orgdb.docs[0].ref
    .collection("Donation_History")
    .where("Status", "!=", "Pending");
  const orgHis = await orgHisRef.get();
  const org_his_data = orgHis.docs.map((doc) => doc.data());
  res.render("org_history", {
    name: userData.organization_name,
    dataArr: { org_his_data },
  });
});

app.post("/donation_collect", async (req, res) => {
  const org_email = req.session.orgEmail;
  const donor_email = req.body.orderemail;
  const orderid = req.body.orderid;

  const donorQuery = db
    .collection("Organizations")
    .where("email", "==", org_email);
  const donorSnapshot = await donorQuery.get();

  const donHisRef = donorSnapshot.docs[0].ref.collection("Donation_History");
  const donHis = await donHisRef.where("OrderId", "==", orderid).get();

  const donationDoc = donHis.docs[0];
  await donationDoc.ref.update({
    Status: "Collected",
  });

  const donQuery = db.collection("Donors").where("email", "==", donor_email);
  const donSnapshot = await donQuery.get();

  //"Donation_History" subcollection
  const donHistoryRef = donSnapshot.docs[0].ref.collection("Donation_History");
  const donData = await donHistoryRef.where("OrderId", "==", orderid).get();

  const donDoc = donData.docs[0];
  await donDoc.ref.update({
    Status: "Collected",
  });

  const orgdb = await db
    .collection("Organizations")
    .where("email", "==", org_email)
    .get();
  const userData = orgdb.docs[0].data();

  const orgHisRef = orgdb.docs[0].ref
    .collection("Donation_History")
    .where("Status", "!=", "Pending");
  const orgHis = await orgHisRef.get();
  const org_his_data = orgHis.docs.map((doc) => doc.data());
  res.render("org_history", {
    name: userData.organization_name,
    dataArr: { org_his_data },
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.render("intro");
});

app.listen(3000, () => {
  console.log("Server runs on port 3000");
});
