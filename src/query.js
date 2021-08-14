const mysql = require("mysql2");
const fs = require("fs");
const helper = require("./helper");

// create the connection to database
const connection = mysql.createConnection({
    host: "vietqr.coxjs6slk9do.ap-southeast-1.rds.amazonaws.com",
    user: "hoannv",
    password: "q2P3BJyvDuv9hDBv",
    database: "devgioi_hoan",
});

// insert to domains
const insertGate = async (domain, gate, platform) => {
    const sql =
        "INSERT INTO payment_gates(domain,gate,platform) SELECT * FROM (SELECT ? AS domain, ? AS gate, ? AS platform)\
        AS temp WHERE NOT EXISTS (SELECT domain,gate, platform FROM payment_gates WHERE domain = ? AND gate=? AND platform=?) LIMIT 1";
    connection.query(
        sql,
        [domain, gate, platform, domain, gate, platform],
        function (err, results, fields) {
            // console.log(results); results contains rows returned by server
            if (results) {
                console.log("Inserted successful");
            }
        }
    );
};

const runQuery = async () => {
    let domains = await helper.readDomains();
    let errorFile = fs.readFileSync("./src/error.txt", "utf8");
    for (let i = 0; i < domains.length; i++) {
        if (fs.existsSync(`./data/${domains[i]}.txt`)) {
            const html = fs.readFileSync(`./data/${domains[i]}.txt`, "utf8");
            let methods = await helper.regexGates(html);
            console.log(`${i} ${domains[i]}: ${methods}`);
            if (methods.length == 0) {
                insertGate(domains[i], "KoTonTai", "woocommerce");
            } else {
                methods.map((method) => {
                    insertGate(domains[i], method, "woocommerce");
                });
            }
        } else if (errorFile.includes(domains[i])) {
            insertGate(domains[i], "KoXacDinh", "woocommerce");
        } else {
            insertGate(domains[i], "KoTonTai", "woocommerce");
        }
    }
    return;
};
module.exports = {
    runQuery,
};
