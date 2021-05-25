const router = require("express").Router()
const {client} = require('../database/database')
const {google} = require('googleapis');
const SCOPES_GMAIL = ['https://mail.google.com/'];
const fs = require('file-system');
const jwt = require("jsonwebtoken")
const axios = require('axios');
const qs = require('qs');
const { API } = require('../config');

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

router.get("/gmail/connection", (req, res) => {
    if (!req.headers.authorization) {
        res.send("not authorized")
        return;
    }
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES_GMAIL,
        state: req.headers.authorization
    });
    res.send({authUrl: authUrl})
})

router.get("/gmail", async (req, res) => {
    tok = req.query.state;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");

    oAuth2Client.getToken(req.query.code, (err, token) => {
        if (err){
            res.status(401).send("error");
            return console.error('Error retrieving access token', err);
        }
        oAuth2Client.setCredentials(token);
        client.query("update users set authGmail = '" + JSON.stringify(token)+ "' where id = " + decoded.indice.toString() + ";");
        res.send("token send")
    });
})

/*

    JUSTE EN DESSOUS C EST POUR AVOIR LE TOKEN OUTLOOK

*/

router.get("/outlook/connection", (req, res) => {
    if (!req.headers.authorization) {
        res.status(401).send("not authorized");
        return;
    }
    var client_id = "320a9e03-38bf-4f49-8930-ea1fb83516d1";
    var client_secret = "rh/==nX[HxmUZnwYA5pANlAlQom7oF49";
    var redirect_uri = API + "/service/outlook";
    var scopes = "email+Mail.ReadWrite+Mail.Send+openid+profile+User.Read+Contacts.ReadWrite";
    var url = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=" + client_id + "&redirect_uri=" + redirect_uri + "&response_type=code&scope=" + scopes + "&state=" + req.headers.authorization;
    res.send(url);
});

router.get("/outlook", async (req, res) => {
    var tok = req.query.state;
    var code = req.query.code
    var decoded = jwt.verify(tok, "Vive_less_273_chatons_et_les_20_chats");
    var client_id = "320a9e03-38bf-4f49-8930-ea1fb83516d1";
    var client_secret = "rh/==nX[HxmUZnwYA5pANlAlQom7oF49";
    var redirect_uri = API + "/service/outlook";

    axios({
        method: 'post',
        url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        headers: {
            'Content-type': 'application/x-www-form-urlencoded'
        },
        data: "grant_type=authorization_code&code=" + code + "&redirect_uri=" + redirect_uri + "&client_id=" + client_id + "&client_secret=" + client_secret
    })
    .then((result) => {
        res.send(result.data);
        client.query("update users set authoutlook = '" + JSON.stringify(token)+ "' where id = " + decoded.indice.toString() + ";");
    }).catch((err) => {
        res.status(400).send("Error occured.");
        console.log(err);
    })
})

/*

        ET ICI POUR GET LES MAILS

*/

router.get("/outlook-mail", async (req, res) => {
    var tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_less_273_chatons_et_les_20_chats");
    var token = await client.query("select authoutlook from users where id =" + decoded.indice.toString() + ";")
    //var token = req.body.token
    axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        res.send(result.data);
    }).catch((err) => {
        res.status(400).send("Error occured.");
        console.log(err);
    })
});

router.get("/outlook-userinfo", async (req, res) => {
    //var decoded = jwt.verify(req.headers.authorization, "Vive_less_273_chatons_et_les_20_chats");
    //var token = await client.query("select authoutlook from users where id =" + decoded.indice.toString() + ";");
    var token = req.body.token
    axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me',
        headers : {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        var info = {
            id: result.data.id,
            mail: result.data.mail,
            name: result.data.displayName,
            job: result.data.jobTitle,
            phone: result.data.businessPhones,
            phone2: result.data.mobilePhone
        }
        res.send(info);
    }).catch((err) => {
        res.status(400).send("Error occured.");
        console.log(err.response.data);
    })
})

module.exports = router