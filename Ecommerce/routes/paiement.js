
const router = require("express").Router()
const jwt = require("jsonwebtoken")

const stripe = require('stripe')('sk_test_51IW08HH1tQZu8g0MwoWxoBgLhDkYW0jjDy4POTugouNEJ62vNwntKKhk1t2obyrpU2QaGz1zddpKGjEXwDxYCni200MXUcUAjV');

const YOUR_DOMAIN = 'https://florian-juniat.github.io/ecomm/';

var mongo = require('mongodb');

var MongoClient = require('mongodb').MongoClient;
var url = "mongodb+srv://florian:ragondin@ecommerce.jrfnd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority"




router.get("/basket", async (req, res) => {
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

              dbo.collection("courses").find({id: {$in: (result[0]).basket}}).toArray(function(err, res2) {
                  if (err) {
                      res.status(500).send("Problem")
                      throw err;
                  }
                  console.log("RESULT2")
                  console.log(res2)
                  res.status(200).send(res2)
              });

          } else {
              res.status(400).send("Don't find any user")
          }
      });

      
  });
});


router.post('/checkout', async (req, res) => {


  if (!req.headers.authorization) {
    res.status(400).send("not Authorized")
    return;
  }
  if (!req.body.product ) {
      res.status(400).send("Item missing")
      return
  }

  tok = req.headers.authorization;
  var decoded = jwt.verify(tok, "Vive_les_273_chatons_et_les_20_chats");

  var listItems = []

  req.body.product.map((pro) => {
    listItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: pro.name,
          images: [pro.picture],
        },
        unit_amount: pro.price * 100,
      },
      quantity: 1,
    })
  })

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: listItems,
    mode: 'payment',
    success_url: `${YOUR_DOMAIN}`,
    cancel_url: `${YOUR_DOMAIN}`,
  });
  res.json({ id: session.id });
});



router.get('/test', async (req, res) => {
    console.log("test")
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Stubborn Attachments',
            images: ['https://i.imgur.com/CUG0Aof.jpeg'],
          },
          unit_amount: 4000,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${YOUR_DOMAIN}/success.html`,
    cancel_url: `${YOUR_DOMAIN}/cancel.html`,
  });
  res.json({ id: session.id });
});


module.exports = router