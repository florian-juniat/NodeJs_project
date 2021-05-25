const router = require("express").Router()
const jwt = require("jsonwebtoken")

var mongo = require('mongodb');

var {PythonShell} = require('python-shell')

var MongoClient = require('mongodb').MongoClient;
var url = "mongodb+srv://florian:ragondin@ecommerce.jrfnd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority"



router.post('/test', async(req, res) => {
    res.send("test florian")
    
})

router.post('/test2', async(req, res) => {
    res.send("test florian")
    
})

router.get("/verify", async (req, res) => {
    if (!req.headers.authorization) {
        res.status(400).send("not Authorized")
        return;
    }

    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");

    console.log(decoded)
    console.log(decoded.id)

    MongoClient.connect(url, function(err, db) {
        if (err) {
            res.status
            throw err;
        }
        var dbo = db.db("myFirstDatabase");

        dbo.collection("users").find({_id: new mongo.ObjectID(decoded.id)}).toArray(function(err, result) {
            if (err) {
                res.status(500).send("Problem")
                throw err;
            }
            if (result.length > 0) {
                res.status(200).send(result[0])
            } else {
                res.status(400).send("Don't find any user")
            }
        });
    });
});



router.post("/login", async (req, res) => {
    if (!req.body) {
        console.log(req)
        res.status(400).send("Body missing")
        return;
    }

    if (!req.body.password || !req.body.name) {
        res.status(400).send("Missing arguments")
        return;
    }


    MongoClient.connect(url, function(err, db) {
        if (err) {
            res.status
            throw err;
        }
        var dbo = db.db("myFirstDatabase");

        dbo.collection("users").find({name: req.body.name}).toArray(function(err, result) {
            if (err) {
                res.status(500).send("Impossible to add element")
                throw err;
            }
            if (result.length > 0) {
                if (result[0].password != req.body.password) {
                    res.status(400).send("Password incorrect")
                    return;
                }
                const payload = {
                    id: result[0]._id,
                };
                const token = jwt.sign(payload, 'Vive_les_273_chatons_et_les_20_chats');
                res.status(200).send(token)
            } else {
                res.status(400).send("User does not exist")
            }
        });
    });
});


router.post("/register", async (req, res) => {

    if (!req.body) {
        console.log(req)
        res.status(400).send("Body missing")
        return;
    }

    if (!req.body.password || !req.body.name || !req.body.education || !req.body.interest || !req.body.reason) {
        res.status(400).send("Missing arguments")
        return;
    }

    MongoClient.connect(url, function(err, db) {
        if (err) {
            res.status
            throw err;
        }
        var dbo = db.db("myFirstDatabase");

        dbo.collection("users").find({name: req.body.name}).toArray(function(err, result) {
            if (err) {
                res.status(500).send("Impossible to add element")
                throw err;
            }
            if (result.length > 0) {
                res.status(400).send("User already exist");
            } else {
                dbo.collection("users").insertOne({
                    name: req.body.name,
                    password: req.body.password,
                    education: req.body.education,
                    interest: req.body.interest,
                    reason: req.body.reason,
                    recommended: [],
                    basket: []
                }, function(err, res2) {
                    if (err) {
                        res.status(500).send("Impossible to add element")
                        throw err;
                    }
                    PythonShell.run('./python/F21EC/collaborative_filtering.py', {}, function(err, result) {
                        if (err) {
                            res.status(500).send(err)
                            return
                        }
                        res.status(200).send("Sign up sucess")
                        db.close();
                    })
                    
                });
            }
        });
    });
});

module.exports = router
