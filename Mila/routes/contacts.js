const router = require("express").Router()
const jwt = require("jsonwebtoken")
const {client} = require('../database/database')
var Base64 = require('js-base64').Base64;
const {google} = require('googleapis')
const axios = require('axios')
const readline = require('readline');
const imageToBase64 = require('image-to-base64');
const fs = require('file-system');
const responseHandler = require('../services/ResponseHandler')

var client_secret;
var client_id;
var redirect_uris;
var credentialsPeople = "";
var oAuth2Client;

var getUserQuery = "select * from users where id = $1;"

const SCOPES = ['https://www.googleapis.com/auth/contacts'];

fs.readFile("./services/credentials_people.json", (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    credentialsPeople = JSON.parse(content);
    client_secret = credentialsPeople.web.client_secret;
    client_id = credentialsPeople.web.client_id;
    redirect_uris = credentialsPeople.web.redirect_uris;
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
});

router.get('/people/connection', async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        state: req.headers.authorization
    });
    responseHandler.successResponse(res, "authentication url generated", {authUrl: authUrl});
});

router.get('/people', async (req, res) => {
    tok = req.query.state;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");

    oAuth2Client.getToken(req.query.code, (err, token) => {
        if (err) {
            responseHandler.errorResponse(res, "error occured", err, 500);
            return console.error('Error retrieving access token', err);
        }
        oAuth2Client.setCredentials(token);
        //let t = JSON.stringify(token)
        var command = "update users set authgooglecontact = '$1' where id = $2;";
        client.query("update users set authgooglecontact = '" + JSON.stringify(token) + "' where id = " + decoded.indice.toString() + ";");
        /*{
            text: command,
            values: [token.toString(), decoded.indice.toString()]
        });*/
        responseHandler.successResponse(res, "token sent");
    });
});

router.get("/gmail/all-contacts" , async (req, res) => {
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

    var element = response.rows[0];
    var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(JSON.parse(element.authgooglecontact));
    const service = google.people({version: 'v1', auth : auth});

    service.people.connections.list({
        resourceName: 'people/me',
        pageSize: 2000,
        personFields: 'names,emailAddresses,phoneNumbers,occupations,organizations,photos'
    },
    (err, result) => {
        if (err) return console.error('The API returned an error: ' + err);
        const connections = result.data.connections;
        var info = [];
        for (let i = 0; i < connections.length; i++) {
            info.push({
                id : connections[i].resourceName,
                etag : connections[i].etag,
                name : connections[i].names ? connections[i].names[0].displayName : "",
                email : connections[i].emailAddresses ? connections[i].emailAddresses[0].value : "",
                numero : connections[i].phoneNumbers ? connections[i].phoneNumbers[0].value : "",
                entreprise : connections[i].organizations ? connections[i].organizations[0].name : "",
                photo : connections[i].photos ? connections[i].photos[0].url : "" 
            })
        }
        responseHandler.successResponse(res, "got contacts", info);
    })
});

router.post("/gmail/delete-contact", async (req, res) => {
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

    var element = response.rows[0];
    var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(JSON.parse(element.authgooglecontact));
    const service = google.people({version: 'v1', auth : auth});

    service.people.deleteContact({
        resourceName : req.body.name_id,
    },
    (err, result) => {
        if (err) return console.error('The API returned an error: ' + err);
        // const connections = result.data.connections;
        // console.log(connections);
    })

    responseHandler.successResponse(res, "contact deleted");
});

router.post("/gmail/add-contact", async (req, res) => {
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

    var element = response.rows[0];
    var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(JSON.parse(element.authgooglecontact));
    const service = google.people({version: 'v1', auth : auth});

    let name = req.body.prenom && !req.body.name ? null : req.body.name.split(' ');
    service.people.createContact({
       auth : auth,
       requestBody : {
           names: [{ givenName: name ? name[0] : req.body.prenom, familyName: name ? name[1] : req.body.nom }],
           emailAddresses: [{ value: req.body.email}],
           phoneNumbers : [{value : req.body.numero}],
           organizations : [{name : req.body.compagny}]

        }
    },
    (err, result) => {
        if (err) return console.error('The API returned an error: ' + err);
    })
    responseHandler.successResponse(res, "contact added");
});

router.post("/gmail/update-contact", async (req, res) => {
    if (!req.headers.authorization) {
        responseHandler.errorResponse(res, "no token provided", [], 401);
        return;
    }

    let personInfo;

    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    
    const response = await client.query({
        text: getUserQuery,
        values: [decoded.indice.toString()]
    });
    
    var element = response.rows[0];
    var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(JSON.parse(element.authgooglecontact));
    const service = google.people({version: 'v1', auth : auth});

    service.people.get({
        auth: auth,
        resourceName: req.body.name_id,
        personFields: 'names,emailAddresses,phoneNumbers,occupations,organizations',
    },
    (error, person) => {
        if (error) return console.error('The APIE returned an error: ' + error);
        personInfo = person.data;
        service.people.updateContact({
            auth,
            resourceName: req.body.name_id,
            updatePersonFields: 'names,emailAddresses,phoneNumbers,occupations,organizations',
            requestBody : {
                etag : personInfo.etag,
                names: [
                    { 
                        givenName: req.body.prenom? req.body.prenom : personInfo.names? personInfo.names[0].givenName : "",
                        familyName: req.body.nom? req.body.nom : personInfo.names? personInfo.names[0].familyName : "",
                        displayName: req.body.prenom && req.body.nom ? req.body.prenom + req.body.nom : personInfo.names? personInfo.names[0].displayName : "",
                    }
                ],
                emailAddresses: [{ value: req.body.email? req.body.email : personInfo.emailAddresses? personInfo.emailAddresses[0].value : ""}],
                phoneNumbers : [{value : req.body.numero? req.body.numero : personInfo.phoneNumbers? personInfo.phoneNumbers[0].value : ""}],
                organizations : [{name : req.body.compagny? req.body.compagny : personInfo.organizations? personInfo.organizations[0].name : ""}]
            }
        },
        (err, result) => {
            if (err) return console.error('The API returned an error: ' + err);
            responseHandler.successResponse(res, "contact updated", result.data);
        })
    });
});

// router.get("/update-picture-contact", async (req, res) => {
//     if (!req.headers.authorization) {
//         res.status(400).send("not authorised")
//         return;
//     }

//     tok = req.headers.authorization;
//     var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");
    
//     const response = await client.query("select * from users where id = " + decoded.indice.toString())
    
//     var element = response.rows[0];
//     var auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
//     auth.setCredentials(JSON.parse(element.authgooglecontact));
//     const service = google.people({version: 'v1', auth : oAuth2Client});

//     var pic = req.body.pic;

//     var picBase64 = await imageToBase64("./psy.jpg") // you can also to use url || "path/to/file.jpg"
//     .then((response) => {
//             console.log(response); //cGF0aC90by9maWxlLmpwZw==
//         })
//     .catch((error) => {
//             console.log(error); //Exepection error....
//         })
//     service.people.updateContactPhoto({
//         auth : auth,
//         resourceName : req.body.name_id,
//         // photoBytes : await imageToBase64(req.body.pic),
//     },
//     (err, result) => {
//         console.log(result);
//         if (err) return console.error('The API returned an error: ' + err);
//     })

//     res.status(200).send("Contact add.")
// });

router.get("/outlook/all-contacts", async (req, res) => {
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
        url: 'https://graph.microsoft.com/v1.0/me/contacts/',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        if (!result.data || !result.data.value) {
            responseHandler.successResponse(res);
            return;
        }
        var ret = [];

        result.data.value.map(item => {
            
            var element = {
                id: item.id,
                name : item.displayName,
                email : item.emailAddresses[0],
                numero : item.mobilePhone,
                entreprise : item.compagnyName,
            }
            ret.push(element)

        })
        responseHandler.successResponse(res, "got contacts", ret);
    }).catch((err) => {
        responseHandler.errorResponse(res, err.response.data, [], 500);
        console.log(err.response.data);
    });
});

router.post("/outlook/:id/delete-contact", async (req, res) => {
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
        url: 'https://graph.microsoft.com/v1.0/me/contacts/' + req.params.id,
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then((result) => {
        responseHandler.successResponse(res, "contact deleted");
    }).catch((err) => {
        responseHandler.errorResponse(res, err.response.data, [], 500);
        console.log(err.response.data);
    })
});

router.post("/outlook/add-contact", async (req, res) => {
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
        url: 'https://graph.microsoft.com/v1.0/me/contacts/',
        headers: {
            'Authorization': 'Bearer ' + token
        },
        data : {
            GivenName: req.body.name,
            EmailAddresses : [{
                Address : req.body.email,
            }],
            CompanyName : req.body.compagny,
            MobilePhone1: req.body.phoneNumber,
        }
    }).then((result) => {
        responseHandler.successResponse(res, "contact created");
    }).catch((err) => {
        responseHandler.errorResponse(res, err.response.data, [], 500);
    })
});


router.post("/outlook/:id/update-contact", async (req, res) => {
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
        method: 'patch',
        url: 'https://graph.microsoft.com/v1.0/me/contacts/' + req.params.id,
        headers: {
            'Authorization': 'Bearer ' + token
        },
        data : {
            GivenName: req.body.nom,
            EmailAddresses : [{
                Address : req.body.email,
            }],
            CompanyName : req.body.compagny,
            MobilePhone1: req.body.numero,
        }
    }).then((result) => {
        responseHandler.successResponse(res, "contactupdated");
    }).catch((err) => {
        responseHandler.errorResponse(res, err.response.data, [], 500);
        console.log(err.response.data);
    });
});

module.exports = router
