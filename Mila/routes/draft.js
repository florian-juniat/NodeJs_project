const router = require("express").Router()
const jwt = require("jsonwebtoken")
const {client} = require('../database/database')
var Base64 = require('js-base64').Base64;
const {google} = require('googleapis')
const axios = require('axios')
const responseHandler = require('../services/ResponseHandler')

var tools = require('../functions/avatar')

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


const checkError = response => {
    if (!response || !response.data || !response.data.message || !response.data.message.payload
    || !response.data.message.payload.headers) return true

    return false
}


const getBody = response => {
    if (response.data && response.data.message && response.data.message.payload && response.data.message.payload.body
        && response.data.message.payload.body.data) {
        return (response.data.message.payload.body.data)
    }
    if (!response.data.message.payload.parts || response.data.message.payload.parts.length == 0
        || !response.data.message.payload.parts[0].parts || response.data.message.payload.parts[0].parts.length == 0
        || !response.data.message.payload.parts[0].parts[0].body) {

            if (response.data && response.data.message && response.data.message.payload && response.data.message.payload.parts && response.data.message.payload.parts.length >= 1)
                return response.data.message.payload.parts[0].body.data
            return ""
        }
    
    return response.data.message.payload.parts[0].parts[0].body.data
}


const getAttchement = response => {
    if (!response.data || !response.data.message || !response.data.message.payload
        || !response.data.message.payload.parts) {
            return []
    }
    if (response.data.message.payload.parts.length === 2) {
        if (response.data.message.payload.parts[1].mimeType == "text/html") {
            return []
        }
    }
    var ret = []
    for (var i = 1; i < response.data.message.payload.parts.length; i++) {
        var element = {
            filename: response.data.message.payload.parts[i].filename,
            mimeType: response.data.message.payload.parts[i].mimeType,
            body : response.data.message.payload.parts[i].body.attachmentId
        }
        ret.push(element)
    }
    return (ret)
}


router.get("/gmail/:id", async (req, res) => {
    if (!req.params.id || !req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");

    const response = await client.query({
        text: getUserQuery,
        values: [decoded.indice.toString()]
    });

    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "unauthorized", [], 401);
        return;
    }
    var element = response.rows[0];
    var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});

    gmail.users.drafts.get({auth: auth, userId: 'me', 'id': req.params.id}, function(err, response) {
        if (err) {
            responseHandler.errorResponse(res, "error occured", err, 500);
            return;
        }

        if (checkError(response)) {
            responseHandler.errorResponse(res, "error occured", [], 500);
            return;
        }
        //res.send(response)
        //return
        var element = {
            id: response.data.id,
            snippet: response.data.message.snippet,
            internalDate: response.data.message.internalDate,
            date: response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "DATE")[0] ? response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "DATE")[0].value : "",
            subject: response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "SUBJECT")[0] ? response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "SUBJECT")[0].value : "",
            to: response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "TO")[0] ? response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "TO")[0].value : "",
            from: response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "FROM")[0] ? response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "FROM")[0].value : "",
            body: getBody(response),
            attachment: getAttchement(response)
        }
        responseHandler.successResponse(res, "got dratf", element);
    });
});


router.get("/gmail", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");

    const response = await client.query({
        text: getUserQuery,
        values: [decoded.indice.toString()]
    });

    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "unauthorized", [], 401);
        return;
    }
    var element = response.rows[0];
    var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});

    var n = 100

    gmail.users.drafts.list({auth: auth, userId: 'me', maxResults: n}, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            responseHandler.errorResponse(res, "error occured", err, 500);
            return;
        }gmail.users.drafts.list
        let ret = []
        for (var i = 0; i < numberDraft; i++) {
            gmail.users.drafts.get({auth: auth, userId: 'me', 'id': response.data.drafts[i].id}, function(err, responseDraft) {
                
                var obj = ""

                for (var j = 0; j < responseDraft.data.message.payload.headers.length; j++) {
                    if ((responseDraft.data.message.payload.headers[j].name).toUpperCase() === "SUBJECT") {
                        obj = responseDraft.data.message.payload.headers[j].value
                    }
                }
                
                var element = {
                    id: responseDraft.data.id,
                    snippet: responseDraft.data.message.snippet,
                    obj: obj,
                    date: responseDraft.data.message.internalDate
                }
                ret.push(element)
                if (ret.length >= numberDraft) {
                    ret = ret.sort((a, b) => (parseInt(a.date) > (parseInt(b.date) ? 1 : -1)))  
                    responseHandler.successResponse(res, "got drafts", ret);
                }
            })
        }
        if (numberDraft === 0) {
            responseHandler.successResponse(res, "got drafts", ret);
        }
    });
})

router.get("/gmail/:id/delete-draft" , async (req, res) => {
    if (!req.params.id || !req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");

    const response = await client.query({
        text: getUserQuery,
        values: [decoded.indice.toString()]
    });

    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "unauthorized", [], 401);
        return;
    }
    var element = response.rows[0];
    var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});

    gmail.users.drafts.delete({auth: auth, userId: 'me', 'id': req.params.id}, function(err, response) {
        if (err) {
            responseHandler.errorResponse(res, "error occured", err, 501);
            return
        }
        responseHandler.successResponse(res, "draft deleted");
    });
});

function makeBody(to, from, subject, message, cc, bcc) {
    var recipients = to.split(';').join(', ');
    var ccRecips = cc ? cc.split(';').join(', ') : null;
    var bccRecips = bcc ? bcc.spli(';').join(', ') : null;
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

    var encodedMail = new Buffer(str).toString("base64").replace(/\+/g, '-').replace(/\//g, '_');
        return encodedMail;
}

router.post("/gmail/:id/modify-draft" , async (req, res) => {
    if (!req.params.id || !req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
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

    if (!req.body.message || !req.body.to || !req.body.from ) { //|| !req.body.obj
        responseHandler.errorResponse(res, "missing parameters", [], 400);
        return;
    }
    var base64UpdatedEmail = makeBody(req.body.to, req.body.from, req.body.obj, req.body.message, req.body.cc, req.body.cci);
    gmail.users.drafts.update({
        auth: auth,
        userId: 'me',
        'id': req.params.id,
        requestBody : {
            message : {
                raw : base64UpdatedEmail,
            }
        },
        'send' : false 
    }, function(err, response) {
        if (err) {
            responseHandler.errorResponse(res, "error occured", err, 401);
            console.log(err);
            return
        }
        responseHandler.successResponse(res, "draft updated");
    });
});


router.post("/gmail/mail-failure" , async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");

    const response = await client.query({
        text: getUserQuery,
        values: [decoded.indice.toString()]
    });

    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "unauthorized", [], 401);
        return;
    }
    var element = response.rows[0];
    var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});

    if (!req.body.message || !req.body.to || !req.body.from ) { //|| !req.body.obj
        responseHandler.errorResponse(res, "missing parameters", [], 400);
        return;
    }

    var base64UpdatedEmail = makeBody(req.body.to, req.body.from, req.body.obj, req.body.message, req.body.cc, req.body.cci);

    gmail.users.drafts.create({
        auth: auth,
        userId: 'me',
        'id': req.params.id,
        requestBody : {
            message : {
                raw : base64UpdatedEmail,
            }
        },
    }, function(err, response) {
        if (err) {
            responseHandler.errorResponse(res, "error occured", err, 500);
            console.log(err);
            return
        }
        responseHandler.successResponse(res, "draft created");
    });
});

router.post("/gmail/save", async (req, res)=> {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    if (!req.body.message || !req.body.to || !req.body.from ) {
        responseHandler.errorResponse(res, "missing parameters", [], 400);
        return;
    }
    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    const response = await client.query({
        text: getUserQuery,
        values: [decoded.indice.toString()]
    });

    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "unauthorized", [], 401);
        return;
    }
    var element = response.rows[0];
    var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});
     var base64UpdatedEmail = makeBody(req.body.to, req.body.from, req.body.obj, req.body.message, req.body.cc, req.body.cci);

    gmail.users.drafts.create({
        auth: auth,
        userId: 'me',
        'id': req.params.id,
        requestBody : {
            message : {
                raw : base64UpdatedEmail,
            }
        },
    }, function(err, response) {
        if (err) {
            responseHandler.errorResponse(res, "error occured", err, 500);
            console.log(err);
            return
        }
        responseHandler.successResponse(res, "draft saved", {
            service: "gmail",
            draftID: response.data.id
        });
    })
});

router.post("/gmail/:id/send", async (req, res) => {
    if (!req.params.id || !req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }

    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    const response = await client.query({
        text: getUserQuery,
        values: [decoded.indice.toString()]
    });

    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "unauthorized", [], 401);
        return;
    }
    var element = response.rows[0];
    var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});

    gmail.users.drafts.send({
        auth: auth,
        userId: 'me',
        requestBody :{
            id: req.params.id
        }
    }).then((result) => {
        responseHandler.successResponse(res, "draft sent");
    }).catch((err) => {
        console.log(err);
        responseHandler.errorResponse(res, "error occured", err, 500);
    });
});


router.post("/outlook/:id/send", async (req, res) => {
    if (!req.params.id || !req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }

    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    const response = await client.query({
        text: getUserQuery,
        values: [decoded.indice.toString()]
    });
    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "unauthorized", [], 401);
        return;
    }
    var element = response.rows[0];
    var token = element.authoutlook;
    var token = req.body.token;
    res.set()

    axios({
        method: 'post',
        url: 'https://graph.microsoft.com/v1.0/me/messages/' + req.params.id + '/send',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        responseHandler.successResponse(res, "draft sent");
    }).catch((err) => {
        console.log(err);
        responseHandler.errorResponse(res, "error ooccured", err, 500);
    })
});

function outlookFormatMail(to, subject, body, cc, cci)
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
        bccRecipients: cciRecips
    }
    return mail
}


router.post("/outlook/save", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }

    body = req.body.body;
    to = req.body.to;
    subject = req.body.obj;
    cc = req.body.cc;
    cci = req.body.cci;

    if (!to) {
        responseHandler.errorResponse(res, "missing parameters", [], 401);
        return;
    }

    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    const response = await client.query({
        text: getUserQuery,
        values: [decoded.indice.toString()]
    });
    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "unauthorized", [], 401);
        return;
    }
    var element = response.rows[0];
    var token = element.authoutolook;
    var mail = outlookFormatMail(to, subject, body, cc, cci);

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
        responseHandler.successResponse(res, "draft saved", {
            service: "outlook",
            draftID: result.data.id
        });
    }).catch((err) => {
        console.log(err.response);
        responseHandler.errorResponse(res, "error occured", err, 500);
    });
});


router.get("/outlook/", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    var tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    var token = await client.query({
        text: "select authoutlook from users where id = $1;",
        values: [decoded.indice.toString()]
    })
    
    token = token.rows[0].authoutlook
    
    axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/drafts/messages',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        if (!result.data || !result.data.value) {
            ResponseHandler.successResponse(res, "got drafts", []);
            return;
        }

        var ret = []

        result.data.value.map(item => {
            
            var element = {
                id: item.id,
                snippet: item.bodyPreview,
                obj: item.subject,
                date: item.lastModifiedDateTime
            }
            ret.push(element)


        })
        responseHandler.successResponse(res, "got drafts", ret);
    }).catch((err) => {
        responseHandler.errorResponse(res, "erro occured", err, 500);
        console.log(err);
    })
});


router.get("/outlook/:id", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    var tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    var token = await client.query({
        text: "select authoutlook from users where id = $1;",
        values: [decoded.indice.toString()]
    });

    token = token.rows[0].authoutlook

    axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/drafts/messages/' + req.params.id,
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        responseHandler.successResponse(res, "got draft", result.data);
        return
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        console.log(err);
    })
});


router.post("/outlook/:id/delete-draft", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    var tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    var token = await client.query({
        text: "select authoutlook from users where id = $1;",
        values: [decoded.indice.toString()]
    });
    
    token = token.rows[0].authoutlook
    
    axios({
        method: 'delete',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/drafts/messages/' + req.params.id,
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        responseHandler.successResponse(res, "draft deleted", result.data);
        return
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        console.log(err);
    })
});

router.post("/outlook/:id/modify-draft", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    var tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    var token = await client.query({
        text: "select authoutlook from users where id = $1;",
        values: [decoded.indice.toString()]
    });

    token = token.rows[0].authoutlook;
    
    axios({
        method: 'patch',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/drafts/messages/' + req.params.id,
        headers: {
            'Authorization': 'Bearer ' + token
        },
        data : {
            subject: req.body.obj,
            body: {
                contentType: "text",
                content: req.body.message,
            },
            From: {
                EmailAddress: {
                    Address: req.body.from,
                }
            },
            ToRecipients: [{
                EmailAddress: {
                    Address: req.body.to
                }
            }],
        }
    }).then((result) => {
        responseHandler.successResponse(res, "draft updated", result.data);
        return
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        console.log(err.response.data);
    })
});


router.post("/outlook/mail-failure", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    var tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    var token = await client.query({
        text: "select authoutlook from users where id = $1;",
        values: [decoded.indice.toString()]
    })

    token = token.rows[0].authoutlook;
    
    axios({
        method: 'post',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/drafts/messages/',
        headers: {
            'Authorization': 'Bearer ' + token
        },
        data : {
            subject: req.body.obj,
            body: {
                contentType: "text",
                content: req.body.message,
            },
            From: {
                EmailAddress: {
                  Address: req.body.from,
                }
            },
            toRecipients:[
                {
                    emailAddress:{
                        address: req.body.to,
                    }
                }
            ],
        }
    }).then((result) => {
        responseHandler.successResponse(res, "draft created");
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        res.status(400).send({error: "error occured."}); 
        console.log(err.response.data);
    })
});









router.get("/unreadDraftGmail" , async (req, res) => {


    if (!req.headers.authorization) {
        res.status(400).send("not authorised")
    }
    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    
    var response = await client.query("select * from users where id = " + decoded.indice.toString())
    
    if (response.rows.length != 1) {
        res.status(400).send("not authorised 2")
    }
    var element = response.rows[0];
    oAuth2Client.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});



    gmail.users.drafts.list({auth: oAuth2Client, userId: 'me', maxResults: 10000000, q:"is:unread"}, function(err, responseStart) {
        if (err) {
            res.status(400).send("dont find ")
            return;
        }
        res.status(200).send((responseStart.data.resultSizeEstimate).toString())
    })
})


















function getOneDraftList(gmail, oAuth2Client, responseAll, indice, ret, stop, res) {

    var message_id = responseAll['data']['drafts'][indice]['id'];
    gmail.users.drafts.get({auth: oAuth2Client, userId: 'me', 'id': message_id}, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }

        name2 = ""
        for (var k = 0; k < response.data.message.payload.headers.length; k++) {
            if (response.data.message.payload.headers[k].name == "Subject") {
                obj = response.data.message.payload.headers[k].value
            }
            if (response.data.message.payload.headers[k].name == "To") {
                name2 = response.data.message.payload.headers[k].value
            }
        }
        name = ""
        mail = ""
        if (name2.length != 0) {
            name = name2.split('<')[0];
            if (name.includes('\"')) {
                name = name.split('\"')[1]
            }
            mail = name2;
        }

        ret.push({
            avatar: tools.generateAvatar(response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "TO")[0] ? response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "TO")[0].value : ""),
            id: response.data.id,
            name: name,
            mail: mail,
            snippet: response.data.message.snippet,
            date: response.data.message.internalDate / 1000,
            subject: response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "SUBJECT")[0] ? response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "SUBJECT")[0].value : "",
            to: response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "TO")[0] ? response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "TO")[0].value : "",
            from: response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "FROM")[0] ? response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "FROM")[0].value : "",
            body: getBody(response),
            attachment: getAttchement(response)
        })

        var compareDate = new Date()
        compareDate.setTime(compareDate.getTime() - 15 * 1000 * 60 * 60 * 24)
        console.log(response.data.internalDate)
        var checkDate = new Date(parseInt(response.data.internalDate))

        console.log("========")
        console.log(compareDate.getDate() + "/" + compareDate.getMonth() + "/" + compareDate.getFullYear() + "\n")
        console.log(checkDate.getDate() + "/" + checkDate.getMonth() + "/" + checkDate.getFullYear() + "\n")

        if (compareDate > checkDate) {
            stop = true
        }

        getDraftList(gmail, oAuth2Client, responseAll, indice + 1, ret, stop, res)
    })

    
}



function getDraftList(gmail, oAuth2Client, response, indice, ret, stop, res) {
    if (stop || !response.data.drafts || response.data.drafts.length <= indice) {
        responseHandler.successResponse(res, "got drafts", ret);
    } else {
        getOneDraftList(gmail, oAuth2Client, response, indice, ret, stop, res)
    }
}







router.get("/draftsGmailList", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");

    var response = await client.query({
        text: "select * from users where id = $1;",
        values: [decoded.indice.toString()]
    });

    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "unauthorized", [], 401);
        return;
    }
    var element = response.rows[0];
    oAuth2Client.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});

    var nbResult = 10000

    var ret = []
    var stop = false


    gmail.users.drafts.list({auth: oAuth2Client, userId: 'me', maxResults: 10000000}, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            responseHandler.errorResponse(res, "error occured", result, 500);
            return;
        }
        getDraftList(gmail, oAuth2Client, response, 0, [], false, res);
    });
});





router.get("/draftOutlookList", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    var tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    var token = await client.query({
        text: "select authoutlook from users where id = $1;",
        values: [decoded.indice.toString()]
    });

    token = token.rows[0].authoutlook

    if (token === null || token.length === 0) {
        responseHandler.errorResponse(res, "not connected to outlook", [], 404);
        return;
    }

    console.log("there is a request for draft")

    var element = []

    await axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/drafts/messages',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        element = result.data.value
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        console.log(err.response.data.error);
    })

    if (!element) {
        responseHandler.errorResponse(res, "error on element", [], 500);
        return;
    }

    var ret = []
    var stop = false
    var nb_skip = 0

    var compareDate = new Date()
    compareDate.setTime(compareDate.getTime() - 15 * 1000 * 60 * 60 * 24)

    while (!stop) {
        
        await axios({
            method: 'get',
            url: 'https://graph.microsoft.com/v1.0/me/mailfolders/drafts/messages?$skip=' + nb_skip.toString(),
            headers: {
                'Authorization': 'Bearer ' + token
            }
        }).then((result) => {
            element = result.data.value
            nb_skip += 10
            if (element.length === 0) {
                stop = true
            }

            for (var i = 0; i < element.length; i++) {

                

                var date = element[i].receivedDateTime
                var hours = element[i].receivedDateTime

                hours = (hours.split('T'))[1]
                hours = (hours.split(':'))

                date = date.split('-')
                
                date[2] = "" + date[2][0] + date[2][1]

                
                var date = new Date(parseInt(date[0]), parseInt(date[1]) - 1, parseInt(date[2]), parseInt(hours[0]), parseInt(hours[1]), 0)

                if (compareDate > date) {
                    stop = true
                } else {
                    ret.push({
                        avatar: tools.generateAvatar(element[i].toRecipients[0] ? element[i].toRecipients[0].emailAddress.name : ""),
                        date: date.getTime(),
                        id: element[i].id,
                        obj: element[i].subject,
                        snippet: element[i].bodyPreview,
                        botox: "outlook",
                        file: [],
                        name: element[i].toRecipients[0] ? element[i].toRecipients[0].emailAddress.name : "",
                        mail:  element[i].toRecipients[0] ? element[i].toRecipients[0].emailAddress.address: "",
                        isRead: element[i].isRead
                    })
                }
            }
        })
    }
    responseHandler.successResponse(res, "got drafts", ret);
});

module.exports = router;
