const router = require("express").Router()
const jwt = require("jsonwebtoken")
const {client} = require('../database/database')
const {google} = require('googleapis')
const axios = require('axios')

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

router.get("/mailGmail/:id", async (req, res) => {
    if (!req.params.id || !req.headers.authorization) {
        res.status(400).send("not authorised")
    }

    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");

    const response = await client.query("select * from users where id = " + decoded.indice.toString())
    
    if (response.rows.length != 1) {
        res.status(400).send("not authorised")
    }
    var element = response.rows[0];
    oAuth2Client.setCredentials(JSON.parse(element.authgmail));
    const gmail = google.gmail({version: 'v1', oAuth2Client});

    gmail.users.messages.get({auth: oAuth2Client, userId: 'me', 'id': req.params.id}, function(err, response) {
        if (err) {
            res.status(400).send("don't find lol ")
            return;
        }
        

        files = []
        if (response.data.payload.mimeType != "text/html" && response.data.payload.parts && response.data.payload.parts.length >= 2) {
            for (var i = 1; i < response.data.payload.parts.length; i++) {
                files.push({
                    filename: response.data.payload.parts[i].filename,
                    type: response.data.payload.parts[i].mimeType,
                    id: response.data.payload.parts[i].body.attachmentId
                })
            }
        }

        var id_attachment = files[0].id


        gmail.users.messages.attachments.get({auth : oAuth2Client, userId : 'me', messageId : req.params.id, id : id_attachment}, function(err, response) {
            if (err) {
                res.status(400).send(err)
                return;
            } else {
                res.status(200).send(new Buffer(response.data.data, 'base64').toString('ascii'))
                //new Buffer(response.data, 'base64').toString('ascii')
                // res.status(200).send(response.data.data)
            }
    
        })

    });
})

module.exports = router