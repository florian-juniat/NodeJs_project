const router = require("express").Router()
const jwt = require("jsonwebtoken")
const { client } = require('../database/database');
const responseHandler = require('../services/ResponseHandler')

router.post("/login", async (req, res) => {
    if (!req.body.password || !req.body.email) {
        responseHandler.errorResponse(res, "missing one or more arguments", [], 401);
        return;
    }
    const response = await client.query("select * from users;").catch(e => console.log(e))
    for (var i = 0; i < response.rows.length; i++) {
        if (response.rows[i].email == req.body.email && 
            response.rows[i].password == req.body.password) {
            const payload = {
                indice: response.rows[i].id,
                email : response.rows[i].email
            };
            const token = jwt.sign(payload, 'Vive_les_273_chatons_et_les_20_chats', { expiresIn: "1h" });
            let data = {
                ...response.rows[i],
                token: token,
                redirect_url: ""
            };
            responseHandler.successResponse(res, "login successful", data);
            return;
        }
    }
    responseHandler.errorResponse(res, "invalid email or password", [], 401);
});

router.post("/register", async (req, res) => {
    if (!req.body.password || !req.body.email) {
        responseHandler.errorResponse(res, "missing one or more arguments", [], 400);
        return;
    }
    try {
        const response = await client.query("select * from users;")
        for (var i = 0; i < response.rows.length; i++) {
            if (response.rows[i].email == req.body.email) {
                responseHandler.errorResponse(res, "user already exists", [], 200);
                return;
            }
        }
        var command = "insert into users(id, email, password) values ($1, $2, $3);"
        const insert = await client.query({
            text: command,
            values: [response.rows.length + 1, req.body.email, req.body.password]
        })
        responseHandler.successResponse(res, 'registered', []);
    } catch (error) {
        responseHandler.errorResponse(res, "", error, 401);
    }
});

module.exports = router
