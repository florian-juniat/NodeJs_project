const router = require("express").Router()
const jwt = require("jsonwebtoken")
const { client } = require('../database/database')
const { google } = require('googleapis')
const axios = require('axios')
const responseHandler = require('../services/ResponseHandler')
var tools = require('../functions/avatar')

const fs = require('file-system');

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

const getBody = response => {
    if (response.data && response.data.payload && response.data.payload.body
        && response.data.payload.body.data) {
        return (response.data.payload.body.data)
    }
    if (!response.data.payload.parts || response.data.payload.parts.length == 0
        || !response.data.payload.parts[0].parts || response.data.payload.parts[0].parts.length == 0
        || !response.data.payload.parts[0].parts[0].body) {

            if (response.data  && response.data.payload && response.data.payload.parts && response.data.payload.parts.length >= 1)
                return response.data.payload.parts[0].body.data
            return ""
        }
    
    return response.data.payload.parts[0].parts[0].body.data
}


const getAttchement = response => {
    if (!response.data  || !response.data.payload
        || !response.data.payload.parts) {
            return []
    }
    if (response.data.payload.parts.length === 2) {
        if (response.data.payload.parts[1].mimeType == "text/html") {
            return []
        }
    }
    var ret = []
    for (var i = 1; i < response.data.payload.parts.length; i++) {
        var element = {
            filename: response.data.payload.parts[i].filename,
            mimeType: response.data.payload.parts[i].mimeType,
            body : response.data.payload.parts[i].body.attachmentId
        }
        ret.push(element)
    }
    return (ret)
}


router.get("/gmail" , async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }

    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");

    const response = await client.query("select * from users where id = " + decoded.indice.toString())
    
    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "unauthorized", [], 401);
        return
    }
    var element = response.rows[0];
    var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});



    gmail.users.messages.list({auth: auth, userId: 'me', maxResults: 100000, labelIds: ["SENT"]}, function(err, responseStart) {
        if (err) {
            responseHandler.errorResponse(res, "don't find", [], 401);
            return;
        }

        var n = responseStart.data.resultSizeEstimate
        gmail.users.messages.list({auth: auth, userId: 'me', maxResults: n, labelIds: ["SENT"]}, function(err, response2) {
            var ret = []
            for (var i = 0; i < n; i++) {
                var message_id = response2['data']['messages'][i]['id'];
                gmail.users.messages.get({auth: auth, userId: 'me', 'id': message_id,}, function(err, response) {
                    if (err) {
                        console.log('The API returned an error: ' + err);
                        return;
                    }
                    var element = {
                        id: response.data.id,
                        date: response.data.internalDate,
                        snippet: response.data.snippet,
                        internalDate: response.data.payload.headers.filter(item => (item.name).toUpperCase() === "DATE")[0] ? response.data.payload.headers.filter(item => (item.name).toUpperCase() === "DATE")[0].value : "",
                        obj: response.data.payload.headers.filter(item => (item.name).toUpperCase() === "SUBJECT")[0] ? response.data.payload.headers.filter(item => (item.name).toUpperCase() === "SUBJECT")[0].value : "",
                        name: response.data.payload.headers.filter(item => (item.name).toUpperCase() === "TO")[0] ? response.data.payload.headers.filter(item => (item.name).toUpperCase() === "TO")[0].value : "",
                        from: response.data.payload.headers.filter(item => (item.name).toUpperCase() === "FROM")[0] ? response.data.payload.headers.filter(item => (item.name).toUpperCase() === "FROM")[0].value : "",
                        content: getBody(response),
                        attachment: getAttchement(response)
                    }
                    ret.push(element)
                    if (ret.length === n) {
                        responseHandler.successResponse(res, "got sent mails", ret);
                        return
                    }
                })  
            }
        })
        if (n === 0) {
            responseHandler.successResponse(res, "got sent mails", []);
            return
        }
    })
})

router.get("/gmail/:id", async (req, res) => {
    if (!req.params.id || !req.headers.authorization) {
        responseHandler.errorResponse(res, "No token provided", [], 401);
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
        responseHandler.errorResponse(res, "Wrong token", [], 401);
        return;
    }

    const response = await client.query({
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

    gmail.users.messages.get({auth: oAuth2Client, userId: 'me', 'id': req.params.id}, function(err, response) {
        if (err) {
            responseHandler.errorResponse(res, "mail not found", err, 404);
            return;
        }
        var obj = ""
        var name2 = ""
/* 
        var checkInbox = false 
        for (var k = 0; k < response.data.labelIds.length; k++) {
            if (response.data.labelIds[k] == "INBOX") {
                checkInbox = true
            }
        }
        if (checkInbox == false) {
            responseHandler.errorResponse(res, "not inbox", [], 400);
            return;
        }
 */
        for (var k = 0; k < response.data.payload.headers.length; k++) {
            if (response.data.payload.headers[k].name == "Subject") {
                obj = response.data.payload.headers[k].value
            }
            if (response.data.payload.headers[k].name == "From") {
                name2 = response.data.payload.headers[k].value
            }
        }
        var name = ""
        var mail = ""
        if (name2.split('<').length > 1) {
            name = name2.split('<')[0];
            if (name.includes('\"')) {
                name = name.split('\"')[1]
            }
            mail = name2.split('<')[1].split('>')[0]
        }
        else
            mail = name2;

        var file = false
        if (response.data.payload.mimeType != "text/html" && response.data.payload.parts && response.data.payload.parts.length >= 2) {
            if (response.data.payload.parts[1].body.attachmentId) {
                file = true
            }
        }
        var body = ""
        var type = ""
        
        if (response.data.payload.parts && response.data.payload.parts.length >= 1 && response.data.payload.parts[0].body) {
            if (response.data.payload.parts[0].mimeType == "text/plain") {
                body = response.data.payload.parts[0].body.data
                type = response.data.payload.parts[0].mimeType
            }
        }

        var files = []
        if (response.data.payload.mimeType != "text/html" && response.data.payload.parts && response.data.payload.parts.length >= 2) {
            for (var i = 1; i < response.data.payload.parts.length; i++) {
                files.push({
                    filename: response.data.payload.parts[i].filename,
                    type: response.data.payload.parts[i].mimeType,
                    id: response.data.payload.parts[i].body.attachmentId
                })
            }
        }
        
        var element = {
            date: parseInt(response.data.internalDate) / 1000,
            id: response.data.id,
            obj: obj,
            body: body,
            botox: "gmail",
            name: name,
            files: files,
            mail: mail
        };
        responseHandler.successResponse(res, "got mail", element);
    });
})


router.get("/outlook/", async (req, res) => {
    var tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    var token = await client.query("select authoutlook from users where id =" + decoded.indice.toString() + ";")
    
    token = token.rows[0].authoutlook
    
    axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/SentItems/messages',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        if (!result.data || !result.data.value) {
            responseHandler.successResponse(res, "got sent mails", []);
            return
        }

        var ret = []

        //console.log(result.data.value)

        result.data.value.map(item => {
            
            var element = {
                id: item.id,
                snippet: item.bodyPreview,
                obj: item.subject,
                date: item.lastModifiedDateTime,
                body : item.body.content,
                attachment : item.hasAttachments,
                from : item.from.emailAddress.address,
                to : item.toRecipients
            }
            ret.push(element)


        })
        responseHandler.successResponse(res, "got sent mails", ret);
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        console.log(err);
    })
});

router.get("/:id/outlook", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "No token provided", [], 401);
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
        responseHandler.errorResponse(res, "Wrong token", [], 401);
        return;
    }
    var token = await client.query({
        text: "select authoutlook from users where id = $1;",
        values: [decoded.indice.toString()]
    });

    token = token.rows[0].authoutlook

    if (token === null || token.length === 0) {
        responseHandler.errorResponse(res, "not connected to outlook", [], 404);
        return;
    }

    var element = []

    await axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/SentItems/messages',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        element = result.data.value
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        console.log(err.response.data.error);
    });

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
            url: 'https://graph.microsoft.com/v1.0/me/mailfolders/SentItems/messages?$skip=' + nb_skip.toString(),
            headers: {
                'Authorization': 'Bearer ' + token
            }
        }).then((result) => {
            element = result.data.value
            nb_skip += 25
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
                } if (req.params.id === element[i].id) {
                    ret.push({
                        avatar: tools.generateAvatar(element[i].sender.emailAddress.name),
                        date: date.getTime(),
                        id: element[i].id,
                        obj: element[i].subject,
                        snippet: element[i].bodyPreview,
                        botox: "outlook",
                        file: [],
                        name: element[i].sender.emailAddress.name,
                        mail:  element[i].sender.emailAddress.address,
                        isRead: element[i].isRead
                    })
                    stop = true
                    break;
                }
            }
        })
    }
    responseHandler.successResponse(res, "got mail", ret);
});

module.exports = router