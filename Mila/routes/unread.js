const router = require("express").Router()
const jwt = require("jsonwebtoken")
const {client} = require('../database/database')
const {google} = require('googleapis')
const axios = require('axios')
const responseHandler = require('../services/ResponseHandler')
const fs = require('file-system');
const { toolresults } = require("googleapis/build/src/apis/toolresults")

var client_secret;
var client_id;
var redirect_uris;
var credentialsGmail = "";
var oAuth2Client;

fs.readFile("./services/credentials_gmail.json", (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    credentialsGmail = JSON.parse(content);
    client_secret = credentialsGmail.web.client_secret;
    client_id = credentialsGmail.web.client_id;
    redirect_uris = credentialsGmail.web.redirect_uris;
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
});





router.get("/gmail" , async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
    }
    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    
    var response = await client.query("select * from users where id = " + decoded.indice.toString())
    
    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "not auhtorized 2", [], 401);
    }
    var element = response.rows[0];
    oAuth2Client.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});

    ret = {
        spam: 0,
        draft: 0,
        mails: 0,
        trash: 0
    }


    gmail.users.drafts.list({auth: oAuth2Client, userId: 'me', maxResults: 10000000}, function(err, responseStart) {
        if (err) {
            responseHandler.errorResponse(res, "draft not found", [], 404);
            return;
        }
        ret.draft = responseStart.data.resultSizeEstimate

        gmail.users.messages.list({auth: oAuth2Client, userId: 'me', maxResults: 100000, includeSpamTrash: true, labelIds: ["SPAM"], q:"is:unread"}, function(err, responseStart) {
            if (err) {
                responseHandler.errorResponse(res, "spam not found", [], 404);
                return;
            }
            ret.spam = responseStart.data.resultSizeEstimate


            gmail.users.messages.list({auth: oAuth2Client, userId: 'me', maxResults: 100000, includeSpamTrash: true, labelIds: ["TRASH"]}, function(err, responseStart) {
                if (err) {
                    responseHandler.errorResponse(res, "trash not found", [], 404);
                    return;
                }

                ret.trash = responseStart.data.resultSizeEstimate

                gmail.users.messages.list({auth: oAuth2Client, userId: 'me', maxResults: 10000000, q:"is:unread"}, function(err, responseStart) {
                    if (err) {
                        responseHandler.errorResponse(res, "mail not found", [], 404);
                        return;
                    }

                    ret.mails = responseStart.data.resultSizeEstimate

                    responseHandler.successResponse(res, "got unread mails", ret);
                })
            })

        })
    })
})








router.get("/outlook", async (req, res) => {
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
    
    var token = await client.query("select authoutlook from users where id =" + decoded.indice.toString() + ";")
    
    token = token.rows[0].authoutlook

    if (token === null || token.length === 0) {
        res.send([])
        return
    }

    ret = {
        spam: 0,
        draft: 0,
        mails: 0,
        trash: 0
    }

    spam = 0
    draft = 0
    mails = 0
    trash = 0

    await axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/inbox/',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        mails = result.data.unreadItemCount
    }).catch((err) => {
        res.status(400).send("Error occured.  ");
        return
    })

    await axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/drafts/',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        draft = result.data.totalItemCount
    }).catch((err) => {
        res.status(400).send("Error occured.  ");
        return
    })

    await axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/deletedItems/',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        trash = result.data.totalItemCount
    }).catch((err) => {
        res.status(400).send("Error occured.  ");
        return
    })

    await axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/junkemail',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        spam = result.data.unreadItemCount
    }).catch((err) => {
        res.status(400).send("Error occured.  ");
        return
    })

    ret.draft = draft
    ret.trash = trash
    ret.mails = mails
    ret.spam = spam


    res.status(200).send(ret)

})




module.exports = router