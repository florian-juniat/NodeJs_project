const router = require("express").Router()
const jwt = require("jsonwebtoken")
const {client} = require('../database/database')
const {google} = require('googleapis')
const axios = require('axios')
const responseHandler = require('../services/ResponseHandler')

const MailComposer = require('nodemailer/lib/mail-composer');


const fs = require('file-system');

var client_secret;
var client_id;
var redirect_uris;
var credentialsGmail = "";
var oAuth2Client;

var getUserQuery = "select * from users where id = $1;";

fs.readFile("./services/credentials_gmail.json", (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    credentialsGmail = JSON.parse(content);
    client_secret = credentialsGmail.web.client_secret;
    client_id = credentialsGmail.web.client_id;
    redirect_uris = credentialsGmail.web.redirect_uris;
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
});


function makeBody(to, from, subject, message, cc, bcc) {
    var recipients = to.split(';').join(', ');
    var ccRecips = cc ? cc.split(';').join(', ') : null;
    var bccRecips = bcc ? bcc.split(';').join(', ') : null;
    var str = ["Content-Type: text/plain; charset=\"UTF-8\"\n",
        "MIME-Version: 1.0\n",
        "Content-Transfer-Encoding: 7bit\n",
        "to: ", recipients, "\n",
        "cc: ", cc ? ccRecips : " ", "\n",
        "bcc: ", bcc ? bccRecips : " ", "\n",
        "from: ", from, "\n",
        "subject: ", subject, "\n\n",
        message
    ].join('');

//     var encodedMail = new Buffer(str).toString("base64").replace(/\+/g, '-').replace(/\//g, '_');
//         return encodedMail;
}



router.post("/gmail", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return
    }
    body = req.body.body
    to = req.body.to
    obj = req.body.obj
    from = req.body.from
    cc = req.body.cc
    bcc = req.body.cci
    if (!to) {
        responseHandler.errorResponse(res, "unauthorized", [], 401);
        return
    }

    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    const response = await client.query({
        text: getUserQuery,
        values: [decoded.indice.toString()]
    });

    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "unauthorized", [], 401);
        return
    }
    var element = response.rows[0];
    var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});
    //var raw = makeBody(to, from, obj, body, cc, bcc)

    var attachments = []

    if (req.body.attachments && req.body.attachments.length > 0) {
        console.log("test")
        for (var k = 0; k < req.body.attachments.length; k++) {
            attachments.push({
                filename: req.body.attachments[k].filename,
                content: req.body.attachments[k].content,
                encoding: 'base64'
            })
        }
    }

    var mailOptions = {
        to: to,
        text: body,
        subject: obj,
        textEncoding: "base64",
        attachments: attachments,
        cc : cc,
        bcc : bcc
    }

    var mail = new MailComposer(mailOptions).compile()
    mail.keepBcc = true
    mail.build( (error, msg) => {
        if (error) return console.log('Error compiling email ' + error);
    
        const encodedMessage = Buffer.from(msg)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        gmail.users.messages.send({
            auth: auth,
            userId: 'me',
            resource: {
                raw: encodedMessage
            }
        }, function(err, response) {
            if (err) {
                res.status(400).send(err)
            } else {
                res.status(200).send(response)
            }
        });
    })
});







// ====================== OUTLOOK ====================




function outlookFormatMail(to, subject, body, cc, cci, attachments)
{
    var allCC;
    var allCCI;
    cciRecips = []
    recipients = []
    ccRecips = []
    var allTo = to.split(';');
    if (cc) {
        allCC = cc.split(';');
        for (let i = 0; allCC[i]; i ++) {
            ccRecips.push({emailAddress: {address: allCC[i]}})
        }
    }
    if (cci) {
        allCCI = cci.split(';');
        for (let i = 0; allCCI[i]; i++) {
            cciRecips.push({emailAddress: {address: allCCI[i]}})
        }
    }
    for (let i = 0; allTo[i]; i++) {
        recipients.push({emailAddress: {address: allTo[i]}})
    }
    var mail = {
        subject: subject,
        body: {
            content: body
        },
        toRecipients: recipients,
        ccRecipients: ccRecips,
        bccRecipients: cciRecips,
        Attachments: attachments
    }
    return mail
}

function sendOutlook(res, id, token)
{
    axios({
        method: 'post',
        url: 'https://graph.microsoft.com/v1.0/me/messages/' + id + '/send',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        responseHandler.successResponse(res, "mail sent");
    }).catch((err) => {
        console.log("ok")
        console.log(err.response);
        responseHandler.errorResponse(res, "error occured", err, 500);
    })
}

router.post("/outlook", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 402);
        return;
    }
    var decoded;
    try {
        if (req.headers.authorization.substr(0, 7) === "Bearer ")
            decoded = jwt.verify(req.headers.authorization.substr(7), "Vive_les_273_chatons_et_les_20_chats");
        else
            decoded = jwt.verify(req.headers.authorization, "Vive_les_273_chatons_et_les_20_chats");
    } catch (err) {
        responseHandler.errorResponse(res, "no token provided", [], 403);
        return;
    }

    body = req.body.body;
    to = req.body.to;
    subject = req.body.obj;
    cc = req.body.cc;
    cci = req.body.cci;

    var attachments = []

    if (req.body.attachments && req.body.attachments.length > 0) {
        console.log("test")
        for (var k = 0; k < req.body.attachments.length; k++) {
            attachments.push({
                "@odata.type": "#Microsoft.OutlookServices.FileAttachment",
                Name: req.body.attachments[k].filename,
                ContentBytes: req.body.attachments[k].content,
            })
        }
    }

    if (!to) {
        responseHandler.errorResponse(res, "missing parameters", [], 404);
        return
    }

    
    const response = await client.query({
        text: getUserQuery,
        values: [decoded.indice.toString()]
    });
    
    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "unauthorized", [], 405);
        return
    }
    var element = response.rows[0];
    var token = element.authoutlook;
    var mail = outlookFormatMail(to, subject, body, cc, cci, attachments)
    console.log(mail.toRecipients)
    axios({
        method: 'post',
        url: 'https://graph.microsoft.com/v1.0/me/messages',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-type': 'application/json'
        },
        data : mail
    })
    .then((result)=> {
        sendOutlook(res, result.data.id, token);
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
    })
});

router.post("/outlook/:id", async (req, res) => {
    if (!req.params.id || !req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    tok = req.headers.authorization;
    id = req.params.id;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    const response = await client.query({
        text: getUserQuery,
        values: [decoded.indice.toString()]
    });
    
    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "unauthorized", [], 401);
        return
    }
    var element = response.rows[0];
    var token = element.authoutolook;
    sendOutlook(res, id, token);
});

module.exports = router
