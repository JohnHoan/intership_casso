const mysql = require("mysql2");
const helper = require("./helper");

// create the connection to database
const pool = mysql.createPool({
    host: "vietqr.coxjs6slk9do.ap-southeast-1.rds.amazonaws.com",
    user: "hoannv",
    password: "q2P3BJyvDuv9hDBv",
    database: "devgioi_hoan",
});

// const pool = mysql.createPool({
//     host: "localhost",
//     user: "root",
//     password: "20041999",
//     database: "internship_casso",
// });

const promisePool = pool.promise();
// insert to domains
const insertDomain = async (domain, num_gates, platform) => {
    try {
        let sql = "SELECT id FROM websites WHERE domain =?";
        let [rows, fields] = await promisePool.query(sql, [domain]);
        if (rows.length > 0) {
            // update
            let sql = "UPDATE websites SET num_gates=? WHERE domain=?";
            await promisePool.query(sql, [num_gates, domain]);
            console.log("updated domain");
            return rows[0]["id"];
        } else {
            // insert
            let sql =
                "INSERT INTO websites(domain,num_gates,platform) VALUES (?,?,?)";
            let [rows, fields] = await promisePool.query(sql, [
                domain,
                num_gates,
                platform,
            ]);
            console.log("inserted domain");
            return rows["insertId"];
        }
    } catch (error) {
        console.log(error);
    }
};

const insertGates = async (domain_id, gate) => {
    let sql = "SELECT id FROM payment_gates WHERE domain_id =? AND gate=?";
    let [rows, fields] = await promisePool.query(sql, [domain_id, gate]);
    if (rows.length > 0) {
        return;
    } else {
        let sql = "INSERT INTO payment_gates(domain_id,gate) VALUES (?,?)";
        await promisePool.query(sql, [domain_id, gate]);
        console.log("inserted gate");
        return;
    }
};

// (async () => {
//     let res = await insertDomain("test1.com", 0, "woo");
//     console.log(res);
// })();

module.exports = {
    insertDomain,
    insertGates,
};
