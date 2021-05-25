const express = require("express")
const bodyParser = require("body-parser")
const app = express()
const http = require("http").createServer(app)
const cors = require('cors')


var mongo = require('mongodb');
var url = "mongodb+srv://florian:ragondin@ecommerce.jrfnd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority"
var MongoClient = require('mongodb').MongoClient;

const authRouter = require("./routes/auth")
const payRouter = require("./routes/paiement")
const homeRouter = require("./routes/home")

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:true}))

app.use("/auth", authRouter)
app.use("/paiement", payRouter)
app.use("/home", homeRouter)

app.get("/test", (req, res) => {


    // Connect to the db
    res.send("TEST")
})

app.get("/", (req, res) => {

    MongoClient.connect(url, function(err, db) {
        if (err) throw err;
        var dbo = db.db("myFirstDatabase");
        dbo.collection("collectionTest").findOne({}, function(err, result) {
          if (err) {
              res.send("Connected to the server... Failed connecting to the database")
              throw err;
          }
          console.log(result.name);
          res.send("Connected to the server and database : " + result.name)
          db.close();
        });
      });
})

/* always keep the 3 next lines as last request handler */ 
app.use(function (req, res) {
    res.send("error")
});

var port = process.env.PORT || 8000
// var port = 8000;

http.listen(port, "0.0.0.0", () => {
	console.log("Server running on port " + port + "...")
})
