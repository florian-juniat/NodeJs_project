const router = require("express").Router()
const jwt = require("jsonwebtoken")
const {client} = require('../database/database')
const {google} = require('googleapis')
const axios = require('axios')

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


function makeBodyForward(to, from, subject, message) {
    var str = ["Content-Type: text/plain; charset=\"UTF-8\"\n",
        "MIME-Version: 1.0\n",
        "Content-Transfer-Encoding: 7bit\n",
        "to: ", to, "\n",
        "from: ", from, "\n",
        "subject: ", subject, "\n\n",
        new Buffer(message, 'base64').toString('ascii')
    ].join('');

    var encodedMail = new Buffer(str).toString("base64").replace(/\+/g, '-').replace(/\//g, '_');
    return encodedMail;
}

router.post("/mailGmail/:id", async (req, res) => {
    // if (!req.params.id || !req.headers.authorization) {
    //     res.status(400).send("not authorised")
    // }

    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");

    const response = await client.query("select * from users where id = " + decoded.indice.toString())
    
    if (response.rows.length != 1) {
        res.status(400).send("not authorised")
    }
    var element = response.rows[0];
    oAuth2Client.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});

    name = ""
    mail = ""
    obj = ""
    name2 = ""
    body = ""
    type = ""

    gmail.users.messages.get({auth: oAuth2Client, userId: 'me', 'id': req.params.id}, function(err, response) {
        if (err) {
            res.status(400).send("don't find ")
            return;
        }

        for (var k = 0; k < response.data.payload.headers.length; k++) {
            if (response.data.payload.headers[k].name == "Subject") {
                obj = response.data.payload.headers[k].value
            }
            if (response.data.payload.headers[k].name == "From") {
                name2 = response.data.payload.headers[k].value
            }
        }

        if (name2.length != 0) {
            name = name2.split('<')[0];
            if (name.includes('\"')) {
                name = name.split('\"')[1]
            }
            mail = name2.split('<')[1].split('>')[0]
        }

        if (response.data.payload.parts && response.data.payload.parts.length >= 1 && response.data.payload.parts[0].body) {
            if (response.data.payload.parts[0].mimeType == "text/plain") {
                body = response.data.payload.parts[0].body.data
                type = response.data.payload.parts[0].mimeType
            }
        }

        body = body
        to = req.body.to
        obj = obj
        from = req.body.from

        if (!to) {
            res.status(400).send("not authorised")
            return
        }
        
        var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        auth.setCredentials(JSON.parse(element.authgmail));

        var raw = makeBodyForward(to, from, obj, body)

        gmail.users.messages.send({
            auth: auth,
            userId: 'me',
            resource: {
                raw: raw
            }
        }, function(err, response) {
            if (err) {
                res.status(400).send(err)
            } else {
                res.status(200).send("ok")
            }
        });
    });
})


module.exports = router