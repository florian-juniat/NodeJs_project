const router = require("express").Router()
const jwt = require("jsonwebtoken")
const { client } = require('../database/database')
const { google } = require('googleapis')
const axios = require('axios')
const responseHandler = require('../services/ResponseHandler')

const fs = require('file-system');

var tools = require('../functions/avatar')

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


router.get("/gmail/unreadSpam" , async (req, res) => {

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
        res.status(400).send({error: "not authorized"})
        return
    }
    var element = response.rows[0];
    var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});



    gmail.users.messages.list({auth: auth, userId: 'me', maxResults: 100000, includeSpamTrash: true, labelIds: ["SPAM"], q:"is:unread"}, function(err, responseStart) {
        if (err) {
            responseHandler.errorResponse(res, "error occured", err, 500);
            return;
        }
        res.status(200).send((responseStart.data.resultSizeEstimate).toString())
    })
})





router.get("/gmailAncien" , async (req, res) => {

    if (!req.headers.authorization) {
        res.status(400).send("not authorised")
        return
    }

    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");

    const response = await client.query("select * from users where id = " + decoded.indice.toString())
    
    if (response.rows.length != 1) {
        res.status(400).send("not authorised")
        return
    }
    var element = response.rows[0];
    var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});



    gmail.users.messages.list({auth: auth, userId: 'me', maxResults: 100000, includeSpamTrash: true, labelIds: ["SPAM", "CATEGORY_PROMOTIONS"]}, function(err, responseStart) {
        if (err) {
            res.status(400).send("dont find ")
            return;
        }

        var n = responseStart.data.resultSizeEstimate
        gmail.users.messages.list({auth: auth, userId: 'me', maxResults: n, includeSpamTrash: true, labelIds: ["SPAM", "CATEGORY_PROMOTIONS"]}, function(err, response2) {
            var ret = []
            for (var i = 0; i < n; i++) {
                var message_id = response2['data']['messages'][i]['id'];
                gmail.users.messages.get({auth: auth, userId: 'me', 'id': message_id,}, function(err, response) {
                    if (err) {
                        console.log('The API returned an error: ' + err);
                        return;
                    }

                    name2 = ""
                    for (var k = 0; k < response.data.payload.headers.length; k++) {
                        if (response.data.payload.headers[k].name == "Subject") {
                            obj = response.data.payload.headers[k].value
                        }
                        if (response.data.payload.headers[k].name == "From") {
                            name2 = response.data.payload.headers[k].value
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

                    var element = {
                        avatar: tools.generateAvatar(name),
                        id: response.data.id,
                        date: response.data.internalDate,
                        name : name,
                        mail : mail,
                        snippet: response.data.snippet,
                        internalDate: response.data.payload.headers.filter(item => (item.name).toUpperCase() === "DATE")[0] ? response.data.payload.headers.filter(item => (item.name).toUpperCase() === "DATE")[0].value : "",
                        subject: response.data.payload.headers.filter(item => (item.name).toUpperCase() === "SUBJECT")[0] ? response.data.payload.headers.filter(item => (item.name).toUpperCase() === "SUBJECT")[0].value : "",
                        to: response.data.payload.headers.filter(item => (item.name).toUpperCase() === "TO")[0] ? response.data.payload.headers.filter(item => (item.name).toUpperCase() === "TO")[0].value : "",
                        from: response.data.payload.headers.filter(item => (item.name).toUpperCase() === "FROM")[0] ? response.data.payload.headers.filter(item => (item.name).toUpperCase() === "FROM")[0].value : "",
                        body: getBody(response),
                        attachment: getAttchement(response)
                    }
                    ret.push(element)
                    if (ret.length === n) {
                        responseHandler.successResponse(res, "got spams", ret);
                        return
                    }
                })
            }
        })
        if (n === 0) {
            responseHandler.successResponse(res, "got spams", []);
            return
        }
    })
})

router.get("/gmail/:id/delete-spam", async (req, res) => {
    if (!req.params.id || !req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided or missing parameters", [], 401);
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

    gmail.users.messages.trash({auth: auth, userId: 'me', 'id': req.params.id}, function(err, response) {
        if (err) {
            responseHandler.errorResponse(res, "error occured", err, 500);
            return;
        }
        responseHandler.successResponse(res, "spam deleted");
    });
})

router.get("/gmail/:id/move-out", async (req, res) => {
    if (!req.params.id || !req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided or missing parameters", [], 401);
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

    gmail.users.messages.modify(
        {auth: auth,
            userId: 'me',
            'id': req.params.id,
            requestBody : {
                addLabelIds: [
                    "INBOX"
                  ],
                removeLabelIds: [
                    "SPAM"
                ]
            },
        }, function(err, response) {
        if (err) {
            responseHandler.errorResponse(res, "error occured", err, 401);
            return;
        }
        responseHandler.successResponse(res, "moved out");
    });
});

// router.get("/gmail/:id/whitelisting", async (req, res) => {
//     if (!req.params.id || !req.headers.authorization) {
//         res.status(400).send("not authorized")
//         return
//     }
//     tok = req.headers.authorization;
//     var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");

//     const response = await client.query("select * from users where id = " + decoded.indice.toString());
//     if (response.rows.length != 1) {
//         res.status(400).send("not authorised")
//         return
//     }
//     var element = response.rows[0];
//     var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
//     auth.setCredentials(JSON.parse(element.authgmail));
//     const gmail = google.gmail({version: 'v1', oAuth2Client});

//     gmail.users.messages.list({auth: auth, userId: 'me', maxResults: 1,  labelIds: ["SPAM"]}, function(err, responseStart) {
//         if (err) {
//             res.status(400).send("dont find ")
//             return;
//         }
//         var message_id = responseStart['data']['messages'][0]['id'];
//         gmail.users.messages.get({auth: auth, userId: 'me', 'id': message_id,}, function(err, response) {
//             if (err) {
//                 console.log('The API returned an error: ' + err);
//                 return;
//             }
//             for (let i = 0; i < response.data.payload.headers.length; i++) {
//                 var result = response.data.payload.headers[i];
//                 if (result.name == "From")
//                     var spam = result.value;
//             }
//         })
//     })

// });

router.get("/outlook/", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    var tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    var token = await client.query({
        text: getUserQuery,
        values: [decoded.indice.toString()]
    });

    token = token.rows[0].authoutlook
    
    axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/junkemail/messages',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        if (!result.data || !result.data.value) {
            responseHandler.successResponse(res, "got spams", []);
            return
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
        responseHandler.successResponse(res, "got spams", ret);
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        console.log(err);
    })
});

router.post("/outlook/:id/delete-spam", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    var tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    var token = await client.query({
        text: getUserQuery,
        values: [decoded.indice.toString()]
    });

    token = token.rows[0].authoutlook

    axios({
        method: 'delete',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/junkemail/messages/' + req.params.id,
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        responseHandler.successResponse(res, "spam deleted");
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        console.log(err);
    });
});

router.get("/outlook/move-out/:id", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    var tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    var token = await client.query({
        text: getUserQuery,
        values: [decoded.indice.toString()]
    });

    token = token.rows[0].authoutlook
    
    axios({
        method: 'post',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages/' + req.params.id + '/move',
        headers: {
            'Authorization': 'Bearer ' + token
        },
        data: {
            destinationId: "inbox"
        },
    }).then((result) => {
        responseHandler(res, "moved out");
        return;
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        res.status(400).send({error: "Error occured."}); 
        console.log(err.response.data);
    })
});













router.get("/spamOutlookList", async (req, res) => {
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
        return
    }

    console.log("there is a request for spam")

    var element = []

    await axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/junkemail/messages',
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
        responseHandler.errorResponse(res, "error occured", [], 500);
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
            url: 'https://graph.microsoft.com/v1.0/me/mailfolders/junkemail/messages?$skip=' + nb_skip.toString(),
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
                }
            }
        })
    }
    responseHandler.successResponse(res, "got spams", ret);
});










function getOneMailList(gmail, oAuth2Client, responseAll, indice, ret, stop, res) {
    var message_id = responseAll['data']['messages'][indice]['id'];
    gmail.users.messages.get({auth: oAuth2Client, userId: 'me', 'id': message_id, includeSpamTrash: true, labelIds: ["SPAM", "CATEGORY_PROMOTIONS"]}, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }

        var checkInbox = false 
        for (var k = 0; k < response.data.labelIds.length; k++) {
            if (response.data.labelIds[k] == "INBOX") {
                checkInbox = true
            }
        }

        obj = ""
        name2 = ""
        for (var k = 0; k < response.data.payload.headers.length; k++) {
            if (response.data.payload.headers[k].name == "Subject") {
                obj = response.data.payload.headers[k].value
            }
            if (response.data.payload.headers[k].name == "From") {
                name2 = response.data.payload.headers[k].value
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

        file = false
        if (response.data.payload.mimeType != "text/html" && response.data.payload.parts && response.data.payload.parts.length >= 2) {
            if (response.data.payload.parts[1].body.attachmentId) {
                file = true
            }
        }
        ret.push({
            avatar: tools.generateAvatar(name),
            date: parseInt(response.data.internalDate) / 1000,
            id: response.data.id,
            obj: obj,
            snippet: response.data.snippet,
            botox: "gmail",
            file: file,
            body: getBody(response),
            attachment: getAttchement(response),
            name: name,
            mail:mail
        });

        var compareDate = new Date()
        compareDate.setTime(compareDate.getTime() - 15 * 1000 * 60 * 60 * 24)
        var checkDate = new Date(parseInt(response.data.internalDate))

        if (compareDate > checkDate) {
            stop = true
        }

        getMailList(gmail, oAuth2Client, responseAll, indice + 1, ret, stop, res)
    })

    
}



function getMailList(gmail, oAuth2Client, response, indice, ret, stop, res) {
    if (stop || response.data.messages.length <= indice) {
        res.send(ret)
    } else {
        getOneMailList(gmail, oAuth2Client, response, indice, ret, stop, res)
    }
}




router.get("/gmail", async (req, res) => {

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
    
    var response = await client.query("select * from users where id = " + decoded.indice.toString())
    
    if (response.rows.length != 1) {
        res.status(400).send("not authorised 2")
    }
    var element = response.rows[0];
    if (!element.authgmail || element.authgmail.length === 0) {
        res.send([])
        return
    }
    oAuth2Client.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});

    var nbResult = 10000

    var ret = []
    var stop = false


    gmail.users.messages.list({auth: oAuth2Client, userId: 'me', maxResults: 10000000, includeSpamTrash: true, labelIds: ["SPAM", "CATEGORY_PROMOTIONS"]}, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            resGet.send(result);
            return
        }
        getMailList(gmail, oAuth2Client, response, 0, [], false, res)
    })
});






module.exports = router