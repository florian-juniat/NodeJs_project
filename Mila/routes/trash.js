const router = require("express").Router()
const jwt = require("jsonwebtoken")
const {client} = require('../database/database')
var Base64 = require('js-base64').Base64;
const {google} = require('googleapis')
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


router.get("/gmail" , async (req, res) => {
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

    gmail.users.messages.list({auth: auth, userId: 'me', maxResults: 100000, includeSpamTrash: true, labelIds: ["TRASH"]}, function(err, responseStart) {
        if (err) {
            responseHandler.errorResponse(res, "error occured", err, 500);
            return;
        }
        var n = responseStart.data.resultSizeEstimate
        gmail.users.messages.list({auth: auth, userId: 'me', maxResults: n, includeSpamTrash: true, labelIds: ["TRASH"]}, function(err, response2) {
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
                        id: response.data.id,
                        date: response.data.internalDate,
                        snippet: response.data.snippet,
                        internalDate: response.data.payload.headers.filter(item => (item.name).toUpperCase() === "DATE")[0] ? response.data.payload.headers.filter(item => (item.name).toUpperCase() === "DATE")[0].value : "",
                        subject: response.data.payload.headers.filter(item => (item.name).toUpperCase() === "SUBJECT")[0] ? response.data.payload.headers.filter(item => (item.name).toUpperCase() === "SUBJECT")[0].value : "",
                        to: response.data.payload.headers.filter(item => (item.name).toUpperCase() === "TO")[0] ? response.data.payload.headers.filter(item => (item.name).toUpperCase() === "TO")[0].value : "",
                        from: response.data.payload.headers.filter(item => (item.name).toUpperCase() === "FROM")[0] ? response.data.payload.headers.filter(item => (item.name).toUpperCase() === "FROM")[0].value : "",
                        body: getBody(response),
                        name: name,
                        mail: mail,
                        attachment: getAttchement(response)
                    }
                    ret.push(element)
                    if (ret.length === n) {
                        responseHandler.successResponse(res, "got trashes", ret);
                        return
                    }
                })
            }
            if (n === 0) {
                responseHandler.successResponse(res, "got trashes", ret);
            }
        })
    })
});

router.get("/gmail/moveToTrash/:id" , async (req, res) => {
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
            return
        }
        responseHandler.successResponse(res, "moved to trash");
    });
});



router.get("/gmail/:id/delete-mail" , async (req, res) => {
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

    gmail.users.messages.untrash({auth: auth, userId: 'me', 'id': req.params.id}, function(err, response) {
        if (err) {
            responseHandler.errorResponse(res, "error occured", err, 500);
            return;
        }
        responseHandler.successResponse(res, "trash deleted");
    });
});

router.post("/gmail/delete-all-mails", async (req, res) => {
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

    gmail.users.messages.list({auth: auth, userId: 'me', maxResults: 100000, includeSpamTrash: true, labelIds: ["TRASH"]}, function(err, responseStart) {
        if (err) {
            responseHandler.errorResponse(res, "error occured", err, 500);
            return;
        }
        var n = responseStart.data.resultSizeEstimate
        console.log("n : " + n);
        gmail.users.messages.list({auth: auth, userId: 'me', maxResults: n, includeSpamTrash: true, labelIds: ["TRASH"]}, function(err, response2) {
            var ret = []
            for (var i = 0; i < n; i++) {
                var message_id = response2['data']['messages'][i]['id'];
                gmail.users.messages.untrash({auth: auth, userId: 'me', 'id': message_id,}, function(err, response) {
                    if (err) {
                        responseHandler.errorResponse(res, "error occured", err, 500);
                        return;
                    }
                })
            }
            responseHandler.successResponse(res, "all trashes deleted");
        });
    });
});


router.get("/gmail/MoveOut/:id" , async (req, res) => {
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
                    "TRASH"
                ]
            },
        }, function(err, response) {
        if (err) {
            responseHandler.errorResponse(res, "error occured", err, 500);
            return;
        }
        responseHandler.successResponse(res, "moved out");
    });
});


router.get("/test" , async (req, res) => {
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

    gmail.users.messages.list({auth: auth, userId: 'me', maxResults: 1,  labelIds: ["INBOX"]}, function(err, responseStart) {
        if (err) {
            responseHandler.errorResponse(res, "error occured", err, 500);
            res.status(400).send({error: "dont find"});
            return;
        }
        var message_id = responseStart['data']['messages'][0]['id'];
        gmail.users.messages.get({auth: auth, userId: 'me', 'id': message_id,}, function(err, response) {
            if (err) {
                responseHandler.errorResponse(res, "error occured", err, 500);
                console.log('The API returned an error: ' + err);
                return;
            }
            responseHandler(res, "test ok", response);
        });
    });
});



router.get("/outlook", async (req, res) => {
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
    axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/deletedItems/messages/',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
    .then((result) => {
        if (!result.data || !result.data.value) {
            responseHandler.successResponse(res, "got trashes", []);
            return;
        }

        var ret = []

        result.data.value.map(item => {
            var date = new Date(item.receivedDateTime).getTime()
            const from = item.from ? item.from.emailAddress : ""

            var element = {
                id: item.id,
                snippet: item.bodyPreview,
                obj: item.subject,
                date: date,
                from : from
            }
            ret.push(element)
        })
        responseHandler.successResponse(res, "got trashes", ret);
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        console.log(err);
    });
});

router.get("/outlook/:id", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    var tok = req.headers.authorization;
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
    
    axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/deletedItems/messages/' + req.params.id,
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        responseHandler.successResponse(res, "got trash", result.data);
        return
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        console.log(err);
    });
});

router.get("/outlook/moveToTrash/:id", async (req, res) => {
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
        method: 'post',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages/' + req.params.id + '/move',
        headers: {
            'Authorization': 'Bearer ' + token
        },
        data: {
            destinationId: "deleteditems"
        },
    }).then((result) => {
        responseHandler.successResponse(res, "moved to trash");
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        res.status(400).send({error: "error occured."}); 
        console.log(err.response.data);
    });
});

router.get("/outlook/moveOutTrash/:id", async (req, res) => {
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
        method: 'post',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/deletedItems/messages/' + req.params.id + '/move',
        headers: {
            'Authorization': 'Bearer ' + token
        },
        data: {
            destinationId: "inbox"
        },
    }).then((result) => {
        responseHandler.successResponse(res, "moved out");
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        console.log(err.response.data);
    });
});

router.post("/outlook/:id/delete-trash", async (req, res) => {
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
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/deletedItems/messages/' + req.params.id,
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        responseHandler.successResponse("trash deleted");
        return;
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        console.log(err);
    });
});

router.post("/outlook/delete-all-mails", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    const response = await client.query({
        text: "select * from users where id = $1;",
        values: [decoded.indice.toString()]
    });
    var token = response.rows[0].authoutlook;
    var element = []
    var stop = false

    await axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/deletedItems/messages/',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        element = result.data.value
    })

    var n = 0;

    while (stop == false) {
        n += 10
        await axios({
            method: 'get',
            url: 'https://graph.microsoft.com/v1.0/me/mailfolders/deletedItems/messages/?$skip=' + n.toString(),
            headers: {
                'Authorization': 'Bearer ' + token
            }
        }).then((result) => {
            if (result.data.value.length < 10) {
                stop = true;
            }
            for (let j = 0; j < result.data.value.length; j++) {
                element.push(result.data.value[j])
            }
        })
    }

    for (let i = 0; i < element.length; i++) {
        var id_message = element[i].id
        await axios({
            method: 'delete',
            url: 'https://graph.microsoft.com/v1.0/me/mailfolders/deletedItems/messages/' + id_message,
            headers: {
                'Authorization': 'Bearer ' + token
            }
        })
    }
    responseHandler.successResponse(res, "all trash deleted");
});






router.post("/outlook/delete-all-mailss", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    const response = await client.query("select * from users where id = " + decoded.indice.toString())
    var token = response.rows[0].authoutlook;
    var element = []

    await axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/deletedItems/messages/',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        element = result.data.value
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        console.log(err.response.data.error);
    })

    let i = 0;
    while (i < element.length) {
        var id_message = element[i].id
        await axios({
            method: 'delete',
            url: 'https://graph.microsoft.com/v1.0/me/mailfolders/deletedItems/messages/' + id_message,
            headers: {
                'Authorization': 'Bearer ' + token
            }
        }).then((result) => {

        }).catch((err) => {
            responseHandler.errorResponse(res, "error occured", err, 500);
            console.log(err);
        })
        i++
        if (i == element.length) {
            i = 0
            await axios({
                method: 'get',
                url: 'https://graph.microsoft.com/v1.0/me/mailfolders/deletedItems/messages/?$skip=10',
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            }).then((result) => {
                element = result.data.value
            }).catch((err) => {
                responseHandler.errorResponse(res, "error occured", err, 500);
                console.log(err.response.data.error);
            })
        }
    }
    responseHandler.successResponse(res, "all trash deleted");
});














function getOneTrashList(gmail, oAuth2Client, responseAll, indice, ret, stop, res) {

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
            avatar: tools.generateAvatar(name),
            id: response.data.id,
            name: name,
            mail: mail,
            snippet: response.data.message.snippet,
            date: response.data.message.internalDate,
            subject: response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "SUBJECT")[0] ? response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "SUBJECT")[0].value : "",
            to: response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "TO")[0] ? response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "TO")[0].value : "",
            from: response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "FROM")[0] ? response.data.message.payload.headers.filter(item => (item.name).toUpperCase() === "FROM")[0].value : "",
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

        getTrashList(gmail, oAuth2Client, responseAll, indice + 1, ret, stop, res)
    })

    
}



function getTrashList(gmail, oAuth2Client, response, indice, ret, stop, res) {
    if (stop || response.data.drafts.length <= indice) {
        responseHandler.successResponse(res, "got trashes", ret);
    } else {
        getOneTrashList(gmail, oAuth2Client, response, indice, ret, stop, res)
    }
}




router.get("/trashGmailList", async (req, res) => {
    console.log("test")
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
            responseHandler.successResponse(res, "got trashes", result);
            return
        }
        getTrashList(gmail, oAuth2Client, response, 0, [], false, res)
    })
});






router.get("/trashOutlookList", async (req, res) => {
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

    var element = []

    await axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/deletedItems/messages/',
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
        responseHandler.errorResponse(res, "error on element", [], 401);
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
            url: 'https://graph.microsoft.com/v1.0/me/mailfolders/deletedItems/messages?$skip=' + nb_skip.toString(),
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
    responseHandler.successResponse(res, "got trashes", ret);
});






module.exports = router