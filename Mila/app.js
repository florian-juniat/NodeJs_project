const cors = require('cors')
const express = require("express")
const bodyParser = require("body-parser")
const app = express()
const http = require("http").createServer(app)

const authRouter = require("./routes/auth")
const servicesRouter = require("./routes/services")
const homeRouter = require("./routes/home")
const sendMailRouter = require("./routes/sendMail")
const draftRouter = require('./routes/draft')
const trashRouter = require('./routes/trash')
const contactsRouter = require('./routes/contacts')
const spamRouter = require("./routes/spam")
const responseHandler = require('./services/ResponseHandler')
const unreadRouter = require("./routes/unread")
const mailAlreadySent = require("./routes/mailAlreadySent")
const replyMail = require("./routes/replyMail")
const forwardMail = require("./routes/forwardMail")
const attachment = require("./routes/attachments")
const mailBySamePerson = require("./routes/mailBySamePerson")

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:true}))

app.use("/auth", authRouter)
app.use("/draft", draftRouter)
app.use("/service", servicesRouter)
app.use("/home", homeRouter)
app.use("/sendMail", sendMailRouter)
app.use("/trash", trashRouter)
app.use("/contacts", contactsRouter)
app.use("/spam", spamRouter)
app.use("/unread", unreadRouter)
app.use("/mailAlreadySent", mailAlreadySent)
app.use("/replyMail", replyMail)
app.use("/forwardMail", forwardMail)
app.use("/attachment", attachment)
app.use("/mailBySamePerson", mailBySamePerson)

app.get("/", (req, res) => {
	responseHandler.successResponse(res, "this is not a server");
})

/* always keep the 3 next lines as last request handler */ 
app.use(function (req, res) {
    responseHandler.errorResponse(res, "Not found", [], 404);
});

var port = process.env.PORT || 8000
// var port = 8000;

http.listen(port, "0.0.0.0", () => {
	console.log("Server running on port " + port + "...")
})
