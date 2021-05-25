const router = require("express").Router()
const jwt = require("jsonwebtoken")
const {client} = require('../database/database')
const {google} = require('googleapis')
const axios = require('axios')
const responseHandler = require('../services/ResponseHandler')
const fs = require('file-system');
const { toolresults } = require("googleapis/build/src/apis/toolresults")

var tools = require('../functions/avatar')

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



function getOneMail(pas, nb_jour, dateDay, dateMonth, dateYear, oAuth2Client, nbResult, result, jour, gmail, responseAll, resGet) {

    if (!responseAll || !responseAll.data || !responseAll.data.messages) {
        responseHandler.successResponse(resGet, "operation succeed", result);;
        return;
    }

    var message_id = responseAll['data']['messages'][pas]['id'];
    gmail.users.messages.get({auth: oAuth2Client, userId: 'me', 'id': message_id}, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            responseHandler.successResponse(resGet, "operation succeed", result);;
            return;
        }

        var checkInbox = false 
        for (var k = 0; k < response.data.labelIds.length; k++) {
            if (response.data.labelIds[k] == "INBOX") {
                checkInbox = true
            }
        }
        if (checkInbox == false) {
            pas = pas + 1
            getMultipleMails(pas, nb_jour, dateDay, dateMonth, dateYear, oAuth2Client, nbResult, result, jour, gmail, responseAll, resGet)
            return
        }

        var d = parseInt(response.data.internalDate);
        var dateNewMail = new Date(d);
        let dateMailDay = ("0" + dateNewMail.getDate()).slice(-2);
        let dateMailMonth = ("0" + (dateNewMail.getMonth() + 1)).slice(-2);
        let dateMailYear = dateNewMail.getFullYear();

        if (dateDay != dateMailDay || dateMonth != dateMailMonth || dateYear != dateMailYear) {
            result.push(jour);
            if (result.length >= 14) {
                responseHandler.successResponse(resGet, "operation succeed", result);;
                return
            }
            jour = [];
            nb_jour++;
            let date_ob = new Date(new Date().getTime() - (nb_jour * 24 * 60 * 60 * 1000));
            dateDay = ("0" + date_ob.getDate()).slice(-2);
            dateMonth = ("0" + (dateNewMail.getMonth() + 1)).slice(-2);
            dateYear = dateNewMail.getFullYear();
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
            // mail = name2.split('<')[1].split('>')[0]
        }

        file = false
        if (response.data.payload.mimeType != "text/html" && response.data.payload.parts && response.data.payload.parts.length >= 2) {
            if (response.data.payload.parts[1].body.attachmentId) {
                file = true
            }
        }
        jour.push({
            date: d,
            id: response.data.id,
            obj: obj,
            snippet: response.data.snippet,
            botox: "gmail",
            file: file,
            name: name,
            mail:mail
        });
        pas = pas + 1
        getMultipleMails(pas, nb_jour, dateDay, dateMonth, dateYear, oAuth2Client, nbResult, result, jour, gmail, responseAll, resGet)
    })
}

function getMultipleMails(pas, nb_jour, dateDay, dateMonth, dateYear, oAuth2Client, nbResult, result, jour, gmail, response, resGet)
{
    if (pas < nbResult) {
        getOneMail(pas, nb_jour, dateDay, dateMonth, dateYear, oAuth2Client, nbResult, result, jour, gmail, response, resGet)
    } else {
        console.log("change")
        getHomeMail(pas, nb_jour, dateDay, dateMonth, dateYear, oAuth2Client, nbResult += 100, result, jour, gmail, resGet)
    }
}

function getHomeMail(pas, nb_jour, dateDay, dateMonth, dateYear, oAuth2Client, nbResult, result, jour, gmail, resGet)
{
    if (result.length >= 14) {
        responseHandler.successResponse(resGet, "operation succeed", result);
        return
    }
    gmail.users.messages.list({auth: oAuth2Client, userId: 'me', maxResults: nbResult}, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            responseHandler.successResponse(resGet, "operation succeed", result);;
            return
        }
        getMultipleMails(pas, nb_jour, dateDay, dateMonth, dateYear, oAuth2Client, nbResult, result, jour, gmail, response, resGet)
    });
}



router.get("/mailsGmail", async (req, res) => {
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
    
    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "unauthorized", [], 401);
        return;
    }
    var element = response.rows[0];
    oAuth2Client.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});

    var result = [];
    var nbResult = 100;
    var pas = 0;
    var nb_jour = 0;
    let date_ob = new Date(new Date().getTime() - (nb_jour * 24 * 60 * 60 * 1000));
    let dateDay = ("0" + date_ob.getDate()).slice(-2);
    let dateMonth = ("0" + (date_ob.getMonth() + 1)).slice(-2);
    let dateYear = date_ob.getFullYear();
    
    
    var jour = [];

    getHomeMail(pas, nb_jour, dateDay, dateMonth, dateYear, oAuth2Client, nbResult, result, jour, gmail, res)

});


function getFilesMail(element, res)
{
    /*gmail.users.messages.attachments.get(
        {
            auth: oAuth2Client,
            userId: 'me',
            messageId: req.params.id,
            id: "ANGjdJ_6a-sXZ7HPIbFPkQQFeseLWfv6jgNT_o9E-_Lxp9i-GwsIE25glRh3qv_2GKSjZ88fvKBHpxcV1kxOn8O2FHYUOY9Thv16BT6-WemzWP2K-BG_LurUD4HOD2q7gWGVo_bihNKIm91M3oDV4O28VO7tlnZxrSq7eXjX-3SwFY3e09LPM1kZAZgzsAJ5A0zeDw5jnLNAGyyWdXzwKJV-IwmifAa08uhT9UWJVg"
        }, function(err, response) {
        
            if (err) {
                console.log(err)
                return
            }
            console.log(response)
    });*/
    responseHandler.successResponse(res, "operation succeed", {...element,files: ["salut"]});
}


router.get("/mailGmail/:id", async (req, res) => {
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


router.get("/outlook-mail", async (req, res) => {
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

    var element = []

    await axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        element = result.data.value
    }).catch((err) => {
        responseHandler.errorResponse(res, "error occured", err, 500);
        return;
    });

    if (!element) {
        responseHandler.errorResponse(res, "error element", [], 401);
        return;
    }

    var ret = []
    var i = 0

    var nb_skip = 0

    var nb_jour = 0;
    let date_ob = new Date(new Date().getTime() - (nb_jour * 24 * 60 * 60 * 1000));
    let dateDay = (("0" + date_ob.getDate()).slice(-2)).toString();
    let dateMonth = (("0" + (date_ob.getMonth() + 1)).slice(-2)).toString();
    let dateYear = (date_ob.getFullYear()).toString();

    var mailInOneDay = []

    while (ret.length < 15) {
        var date = element[i].receivedDateTime.split("-")
        var dateYearMail = date[0]
        var dateMonthMail = date[1]
        var dateDayMail = date[2][0] + date[2][1] + ""
        if (dateDay != dateDayMail || dateMonth != dateMonthMail || dateYear != dateYearMail) {
            nb_jour = nb_jour + 1
            date_ob = new Date(new Date().getTime() - (nb_jour * 24 * 60 * 60 * 1000));
            dateDay = (("0" + date_ob.getDate()).slice(-2)).toString();
            dateMonth = (("0" + (date_ob.getMonth() + 1)).slice(-2)).toString();
            dateYear = (date_ob.getFullYear()).toString();
            ret.push(mailInOneDay)
            mailInOneDay = []
        } else {
            mailInOneDay.push({
                date: element[i].receivedDateTime,
                id: element[i].id,
                obj: element[i].subject,
                snippet: element[i].bodyPreview,
                botox: "outlook",
                file: [],
                name: element[i].sender.emailAddress.name,
                mail:  element[i].sender.emailAddress.address,
                isRead: element[i].isRead
            })
            i++
        }
        if (i >= element.length) {
            nb_skip += 10
            await axios({
                method: 'get',
                url: 'https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages?$skip=' + nb_skip.toString(),
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            }).then((result) => {
                element = result.data.value
                i = 0
            })
        }
    }
    if (ret.length < 15 && mailInOneDay.length > 0) {
        ret.push(mailInOneDay)
    }
    responseHandler.successResponse(res, "got mails", ret);
});

function getOneMailList(gmail, oAuth2Client, responseAll, indice, ret, stop, res) {
    var message_id = responseAll['data']['messages'][indice]['id'];
    gmail.users.messages.get({auth: oAuth2Client, userId: 'me', 'id': message_id}, function(err, response) {
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
            name: name,
            mail:mail
        });

        var compareDate = new Date()
        compareDate.setTime(compareDate.getTime() - 15 * 1000 * 60 * 60 * 24)
        //console.log(response.data.internalDate)
        var checkDate = new Date(parseInt(response.data.internalDate))

        //console.log("========")
        //console.log(compareDate.getDate() + "/" + compareDate.getMonth() + "/" + compareDate.getFullYear() + "\n")
        //console.log(checkDate.getDate() + "/" + checkDate.getMonth() + "/" + checkDate.getFullYear() + "\n")

        if (compareDate > checkDate) {
            stop = true
        }
        getMailList(gmail, oAuth2Client, responseAll, indice + 1, ret, stop, res)
    })
}

function getMailList(gmail, oAuth2Client, response, indice, ret, stop, res) {
    if (stop || response.data.messages.length <= indice) {
        responseHandler.successResponse(res, "got mails", ret);
    } else {
        getOneMailList(gmail, oAuth2Client, response, indice, ret, stop, res)
    }
}

router.get("/mailsGmailList", async (req, res) => {
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

    var response = await client.query({
        text: "select * from users where id = $1;",
        values: [decoded.indice.toString()]
    });

    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "unauthorized", [], 401);
        return;
    }
    var element = response.rows[0];
    if (!element.authgmail || element.authgmail.length === 0) {
        responseHandler.errorResponse(res, "not connected to gmail", [], 404);
        return;
    }
    oAuth2Client.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});

    var nbResult = 10000

    var ret = []
    var stop = false

    gmail.users.messages.list({auth: oAuth2Client, userId: 'me', maxResults: 10000000}, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            resGet.status(500).send(result);
            return
        }
        getMailList(gmail, oAuth2Client, response, 0, [], false, res)
    })
});

router.get("/mailsGmailList/:nb", async (req, res) => {
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

    var response = await client.query({
        text: "select * from users where id = $1;",
        values: [decoded.indice.toString()]
    });

    if (response.rows.length != 1) {
        responseHandler.errorResponse(res, "Unauthorized", [], 401);
        return;
    }
    var element = response.rows[0];
    if (!element.authgmail || element.authgmail.length === 0) {
        responseHandler.errorResponse(res, "Not connected to gmail", [], 401);
        return;
    }

    oAuth2Client.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});

    var messages = [];
    var response;
    var pageTokenRes = null;
    var ret = [];
    var failed;
    var i = 0;
    
    do {
        response = await gmail.users.messages.list({
            auth: oAuth2Client,
            userId: 'me',
            pageToken: pageTokenRes,
            maxResults: 500
        }).catch(e => {
            console.error(e);
        });
        messages = messages.concat(response.data.messages);
        for (let i = 0; i < messages.length; i++) {
            failed = false;
            const message = await gmail.users.messages.get({
                auth: oAuth2Client,
                userId: 'me',
                'id': messages[i]['id']
            }).catch(e => {
                failed = true;
                console.error(e);
            });
            if (failed)
                continue;
            var nb = req.params.nb;
            var startDate = new Date(Date.now());
            startDate.setTime(startDate.getTime() - 14 * nb * 1000 * 60 * 60 * 24)
            var endDate = new Date(Date.now());
            nb++;
            endDate.setTime(endDate.getTime() - 14 * nb * 1000 * 60 * 60 * 24)
            var checkDate = new Date(parseInt(message.data.internalDate))         
            if (checkDate > startDate)
                continue;
            if (checkDate < endDate)
                return res.status(200).send(ret);
            var obj;
            var mail;
            message.data.payload.headers.forEach(header => {
                if (header.name == "Subject")
                    obj = header.value;
                if (header.name == "From")
                    mail = header.value;
            });
            var name = mail.split('<')[0].trim();
            var file = false
            if (message.data.payload.mimeType != "text/html" && message.data.payload.parts && message.data.payload.parts.length >= 2) {
                if (message.data.payload.parts[1].body.attachmentId) {
                    file = true
                }
            }
            ret.push({
                avatar: tools.generateAvatar(name),
                date: parseInt(message.data.internalDate),
                id: message.data.id,
                labels: message.data.labels,
                snippet: message.data.snippet,
                botox: "gmail",
                file: file,
                name: name,
                mail: mail,
                obj: obj
            });
        }
        if (response.data.nextPageToken)
            pageTokenRes = response.data.nextPageToken;
    } while (response.data.nextPageToken);
    res.status(200).send(ret);
});

router.get("/mailsOutlookList", async (req, res) => {
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
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages',
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
            url: 'https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages?$skip=' + nb_skip.toString(),
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
    responseHandler.successResponse(res, "got mails", ret);
});

router.get("/mailOutlook/:id", async (req, res) => {
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
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages',
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
            url: 'https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages?$skip=' + nb_skip.toString(),
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
                } else if (req.params.id == element[i].id) {
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