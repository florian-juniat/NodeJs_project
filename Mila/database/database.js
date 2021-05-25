const {Pool} = require('pg');

const client = new Pool({
    user: "FakeUser",
    password: "FakePassword",
    host: "FakeHost(private database sorry)",
    port: 5432,
    database: "mila"
})

module.exports = {
    client : client
};