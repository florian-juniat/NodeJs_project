const router = require("express").Router()
const { client } = require('../database/database')
const { google } = require('googleapis');
const SCOPES_GMAIL = ['https://mail.google.com/'];
const fs = require('file-system');
const jwt = require("jsonwebtoken")
const axios = require('axios');
const { API } = require('../config');
const responseHandler = require('../services/ResponseHandler')

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
    let state;
    if (!req.headers.authorization && !req.body.token)
        state = "createUser";
    else
        state = req.headers.authorization;

    var decoded;
    try {
        if (state != "createUser") {
            if (state.substr(0, 7) === "Bearer ")
                decoded = jwt.verify(state.substr(7), "Vive_les_273_chatons_et_les_20_chats");
            else
                decoded = jwt.verify(state, "Vive_les_273_chatons_et_les_20_chats");
        }
    } catch (err) {
        console.error(err);
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES_GMAIL,
        state: state
    });
    responseHandler.successResponse(res, "connected", {authUrl: authUrl});
})

router.get("/gmail", async (req, res) => {
    if (req.query.state != "createUser") {
        var decoded;
        try {
            if (req.query.state.substr(0, 7) === "Bearer ")
                decoded = jwt.verify(req.query.state.substr(7), "Vive_les_273_chatons_et_les_20_chats");
            else
                decoded = jwt.verify(req.query.state, "Vive_les_273_chatons_et_les_20_chats");
        } catch (err) {
            console.error(err);
            responseHandler.errorResponse(res, "no token provided", [], 401);
            return;
        }

        oAuth2Client.getToken(req.query.code, (err, token) => {
            if (err){
                responseHandler.errorResponse(res, "error occured", err, 500);
                return console.error('Error retrieving access token', err);
            }
            oAuth2Client.setCredentials(token);
            client.query("update users set authGmail = '" + JSON.stringify(token)+ "' where id = " + decoded.indice.toString() + ";");
            res.redirect('http://localhost:3000/Re%C3%A7us')
        });
    } else {
         oAuth2Client.getToken(req.query.code, async (err, token) => {
            if (err) {
                responseHandler.errorResponse(res, "error occured", err, 500);
                return console.error('Error retrieving access token', err);
            }
            oAuth2Client.setCredentials(token);
            try {
                const gmail = google.gmail({version: 'v1', oAuth2Client});
                gmail.users.getProfile({auth: oAuth2Client, userId: 'me'}, async function (err, response) {
                    if (err)  {
                        throw err;
                    }
                    const insert = await client.query({
                        text: "insert into users(email, authGmail) values ($1, $2) returning (id);",
                        values: [response.data.emailAddress, JSON.stringify(token)]
                    });
                    const payload = {
                        indice: insert.rows[0].id,
                        email: response.data.emailAddress
                    };
                    const tok = jwt.sign(payload, 'Vive_les_273_chatons_et_les_20_chats', { expiresIn: "1h"});
                    responseHandler.successResponse(res, "account created", {
                        token: tok,
                        redirect_url: "http://localhost:3000/Re%C3%A7us"
                    });
                });
            } catch (e) {
                responseHandler.errorResponse(res, "error occured", e.message, 500);
            }
         });
    }
});

router.get("/outlook/connection", (req, res) => { 
    let state;
    if (!req.headers.authorization) {
        state = "createUser";
    } else {
        if (req.headers.authorization.substr(0, 7) === "Bearer ")
            state = req.headers.authorization.substr(7)
        else
            state = req.headers.authorization
    }
    console.log(state)
    var client_id = "61eeec89-92b1-41d7-a6a6-6c3ccda9be3c";
    var client_secret = "PX-jPZN_6mLDa_KL_JNA7tlFBVC5VG2t_5";
    var redirect_uri = "http://localhost:8000/service/outlook";
    var scopes = "email+Mail.ReadWrite+Mail.Send+openid+profile+User.Read+Contacts.ReadWrite";
    var url = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=" + client_id + "&redirect_uri=" + redirect_uri + "&response_type=code&scope=" + scopes + "&state=" + state;
    responseHandler.successResponse(res, "succeed", {authUrl: url});
});

router.get("/outlook", async (req, res) => {
    var client_id = "61eeec89-92b1-41d7-a6a6-6c3ccda9be3c";
    var client_secret = "PX-jPZN_6mLDa_KL_JNA7tlFBVC5VG2t_5";
    var redirect_uri = API + "/service/outlook";
    if (req.query.state != "createUser") {
        var tok = req.query.state;
        var code = req.query.code
        var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
        axios({
            method: 'post',
            url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            headers: {
                'Content-type': 'application/x-www-form-urlencoded'
            },
            data: "grant_type=authorization_code&code=" + code + "&redirect_uri=" + redirect_uri + "&client_id=" + client_id + "&client_secret=" + client_secret
        })
        .then((result) => {
            console.log("====RESULT====")
            console.log(result)
            client.query("update users set authoutlook = '" + result.data.access_token+ "' where id = " + decoded.indice.toString() + ";");
            res.redirect('http://localhost:3000/Re%C3%A7us')
        }).catch((err) => {
            console.error(err);
            responseHandler.errorResponse(res, "error occured", err, 500);
        })
    } else {
        try {
            let code = req.query.code;
            const response = await axios({
                method: 'post',
                url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
                headers: {
                    'Content-type': 'application/x-www-form-urlencoded'
                },
                data: "grant_type=authorization_code&code=" + code + "&redirect_uri=" + redirect_uri + "&client_id=" + client_id + "&client_secret=" + client_secret
            });
            let token = response.data.access_token;
            const userInfos = await axios({
                method: 'get',
                url: 'https://graph.microsoft.com/v1.0/me',
                headers : {
                    'Authorization': 'Bearer ' + token
                }
            });
            //const getUser = await client.query("select * from users;")
            const insert = await client.query({
                text: "insert into users(email, authoutlook) values ($1, $2) returning (id);",
                values: [userInfos.data.mail, token]
            });
            const payload = {
                indice: insert.rows[0].id,
                email: userInfos.data.mail
            };
            const tok = jwt.sign(payload, 'Vive_les_273_chatons_et_les_20_chats', { expiresIn: "1h"});
            responseHandler.successResponse(res, "account created", {
                token: tok,
                redirect_url: "http://localhost:3000/Re%C3%A7us"
            });     
        } catch (e) {
            responseHandler.errorResponse(res, "error occured", e.message, 500);
        }

    }
})

router.get("/outlook-mail", async (req, res) => {
    var tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    var token = await client.query({
        text: "select authoutlook from users where id = $1;",
        values: [decoded.indice.toString()]
    });

    token = token.rows[0].authoutlook
    
    axios({
        method: 'get',
        url: 'https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        res.send(result.data);
    }).catch((err) => {
        res.status(400).send({error: "error occured."});
        console.log(err);
    })
});

router.get("/outlook-userinfo", async (req, res) => {
    var decoded = jwt.verify(req.headers.authorization, "Vive_les_273_chatons_et_les_20_chats");
    var token = await client.query({
        text: "select authoutlook from users where id = $1;",
        values: [decoded.indice.toString()]
    });
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
        res.status(400).send({error: "Error occured."});
        console.log(err);
    })
})

module.exports = router