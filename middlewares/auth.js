var express = require("express");
var router = express.Router();
var errors = require("../utils/errors");
var Odoo = require("node-odoo");
var redis = require("redis");
var uuid = require("uuid");
var config = require("../config");

router.post("/login", function(req, res) {
  var params = {
    ...config,
    username: req.body.username || "admin",
    password: req.body.password || "asdf"
  };
  var odoo = new Odoo(params);

  odoo.connect(function(err, params) {
    if (err) return errors(res, err);
    var { db, uid, user_context, company_id } = params;
    if (!uid) return errors(res, new Error("Fallo1"));
    var conn = redis.createClient();
    var session_id = uuid();
    conn.set(
      session_id,
      JSON.stringify({
        username: req.body.username,
        password: req.body.password
      }),
      "EX",
      3600
    );
    conn.quit();
    res.statusCode = 201;
    res.json({
      success: true,
      session: {
        user_context: user_context,
        uid: uid,
        db: db,
        company_id: company_id,
        session_id: session_id
      }
    });
  });
});

router.get("/session", function(req, res) {
  var { authorization } = req.headers;
  var conn = redis.createClient();
  conn.get(authorization, function(err, _session) {
    if (!_session) return errors(res, new Error("Fallo2"));
    var session = JSON.parse(_session);
    conn.quit();
    var params = {
      ...config,
      username: session.username || "",
      password: session.password || ""
    };
    var odoo = new Odoo(params);
    odoo.connect(function(err, { uid }) {
      if (err) return errors(res, err);
      if (!uid) return errors(res, new Error("Fallo3"));
      res.json({
        success: true
      });
    });
  });
});

router.get("/logout", function(req, res) {
  var { authorization } = req.headers;
  var conn = redis.createClient();
  conn.set(authorization, "", "ex", 1);
  res.json({
    success: true
  });
});

router.use(function(req, res, next) {
  var { authorization = "" } = req.headers;
  var { token = "" } = req.query;
  var conn = redis.createClient();
  if (!authorization && !token) return errors(res, new Error("Fallo4"));
  conn.get(authorization || token, function(err, _session) {
    // if (!_session) return errors(res, new Error(_session));
    // var session = JSON.parse(_session);
    conn.quit();
    // var params = {
    //   ...config,
    //   username: session.username || "admin",
    //   password: session.password || "asdf"
    // };
    var params = {
      ...config,
      username: "admin",
      password: "asdf"
    };

    var odoo = new Odoo(params);
    odoo.connect(function(err, { uid }) {
      if (err) return errors(res, err);
      if (!uid) return errors(res, new Error("Fallo6"));
      req.odoo = odoo;
      next();
    });
  });
});

module.exports = router;
