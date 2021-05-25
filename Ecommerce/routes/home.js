const router = require("express").Router()
const jwt = require("jsonwebtoken")

var mongo = require('mongodb');

var MongoClient = require('mongodb').MongoClient;
var url = "mongodb+srv://florian:ragondin@ecommerce.jrfnd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority"




router.get("/coursesAvant", async (req, res) => {
    if (!req.headers.authorization) {
        res.status(400).send("not Authorized")
        return;
    }

    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");


    MongoClient.connect(url, function(err, db) {
        if (err) {
            res.status
            throw err;
        }
        var dbo = db.db("myFirstDatabase");

        dbo.collection("courses").find({}).toArray(function(err, result) {
            if (err) {
                res.status(500).send("Problem")
                throw err;
            }
            if (result.length > 0) {
                res.status(200).send(result)
            } else {
                res.status(400).send("Error")
            }
        });
    });
});



router.get("/courses", async (req, res) => {
    if (!req.headers.authorization) {
        res.status(400).send("not Authorized")
        return;
    }

    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");


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
                console.log("RESULT 1")

                console.log(result)

                dbo.collection("courses").find().toArray(function(err, res2) {
                    if (err) {
                        res.status(500).send("Problem")
                        throw err;
                    }
                    console.log("RESULT2")
                    console.log(res2)
                    res.status(200).send({product: res2, basket: (result[0]).basket.length})
                });

            } else {
                res.status(400).send("Don't find any user")
            }
        });

        
    });
});



router.get("/recommended", async (req, res) => {
    if (!req.headers.authorization) {
        res.status(400).send("not Authorized")
        return;
    }

    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");


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
                console.log("RESULT 1")

                console.log(result)

                dbo.collection("courses").find({id: {$in: (result[0]).recommended}}).toArray(function(err, res2) {
                    if (err) {
                        res.status(500).send("Problem")
                        throw err;
                    }
                    console.log("RESULT2")
                    console.log(res2)
                    res.status(200).send({product: res2, basket: (result[0]).basket.length})
                });

            } else {
                res.status(400).send("Don't find any user")
            }
        });

        
    });
});

router.post("/addToBasket", async (req, res) => {
    if (!req.headers.authorization) {
        res.status(400).send("not Authorized")
        return;
    }
    if (!req.body.idItem ) {
        res.status(400).send("Item missing")
        return
    }

    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");


    MongoClient.connect(url, function(err, db) {
        if (err) {
            res.status
            throw err;
        }
        var dbo = db.db("myFirstDatabase");
        dbo.collection("users").update({_id: new mongo.ObjectID(decoded.id)}, {$addToSet: {"basket": req.body.idItem}}, function(err, res2) {
            if (err) {
                res.status(500).send("Impossible to add element")
                throw err;
            }
            res.status(200).send("Element added")
            db.close();
        })
    })
})




router.post("/removeToBasket", async (req, res) => {
    if (!req.headers.authorization) {
        res.status(400).send("not Authorized")
        return;
    }
    if (!req.body.idItem ) {
        res.status(400).send("Item missing")
        return
    }

    tok = req.headers.authorization;
    var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");


    MongoClient.connect(url, function(err, db) {
        if (err) {
            res.status
            throw err;
        }
        var dbo = db.db("myFirstDatabase");
        dbo.collection("users").update({_id: new mongo.ObjectID(decoded.id)}, {$pull: {"basket": req.body.idItem}}, function(err, res2) {
            if (err) {
                res.status(500).send("Impossible to add element")
                throw err;
            }
            res.status(200).send("Element added")
            db.close();
        })
    })
})



module.exports = router
