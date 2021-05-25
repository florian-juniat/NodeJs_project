const router = require("express").Router()
const { client } = require('../database/database')
const { google } = require('googleapis');
const SCOPES_GMAIL = ['https://mail.google.com/'];
const fs = require('file-system');
const jwt = require("jsonwebtoken")
const axios = require('axios');
const { API } = require('../config');
const responseHandler = require('../services/ResponseHandler')

var client_secret;
var client_id;
var redirect_uris;
var credentialsGmail = "";
var oAuth2Client;

router.post("/mailBySamePerson", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    var decoded;
    try {
        if (req.headers.authorization.substr(0, 7) === "Bearer ")
            decoded = jwt.verify(req.headers.authorization.substr(7), "Vive_les_273_chatons_et_les_20_chats");
        else
            decoded = jwt.verify(req.headers.authorization, "Vive_les_273_chatons_et_les_20_chats");
    } catch (err) {
        console.error(err);
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    const email = req.body.email;
    const request = await axios.get(API + "/home/mailsGmailList", {
        headers: {
            'authorization': req.headers.authorization
        }
    }).catch(e => {
        e => console.error(e.stack)
        responseHandler.errorResponse(res, "failed to retrieve mails", [], 500);
    });
    const mails = request.data.data;
    var tmp;
    var data = [];
    for (var i = 0; i < mails.length; i++) {
        if (mails[i].mail.split(" ").length == 1) {
            //console.log(mails[i].mail);
            tmp = mails[i].mail;
        }
        else {
            tmp = mails[i].mail.split(" ")[mails[i].mail.split(" ").length - 1];
            //console.log(tmp.substr(1, tmp.length - 2))
            tmp = tmp.substr(1, tmp.length - 2);
        }
        if (tmp == email)
            data.push(mails[i]);
    }
    responseHandler.successResponse(res, "retrieving successful", data);
})

module.exports = router