const fs = require("fs");
const fetch = require("node-fetch");
const HTMLParser = require("node-html-parser");
const getHrefs = require("get-hrefs");

/* find add-to-cart href in hrefs*/
const addToCart = async (hrefs) => {
    let res;
    let end = hrefs.length;
    for (let i = 0; i < end; i++) {
        if (hrefs[i].includes("add-to-cart")) {
            res = hrefs[i];
            break;
        }
    }
    return res;
};

/* find the cart link in website */
const cart = async (links) => {
    let res = "";
    let end = links.length;
    for (let i = 0; i < end; i++) {
        if (links[i].includes("/cart")) {
            res = links[i];
            break;
        }
        if (links[i].includes("/gio-hang")) {
            res = links[i];
            break;
        }
    }
    return res;
};

/* find checkout link in the website */
const checkout = async (links) => {
    let res = "";
    let end = links.length;
    for (let i = 0; i < end; i++) {
        if (links[i].includes("/checkout")) {
            res = links[i];
            break;
        }
        if (links[i].includes("/thanh-toan")) {
            res = links[i];
            break;
        }
        if (links[i].includes("/dat-hang")) {
            res = links[i];
            break;
        }
    }
    return res;
};

/* get all hrefs in the website */
const getAllHrefs = async (url) => {
    let response = await fetch(url, { timeout: 45000 });
    let html = await response.text();
    let hrefs = getHrefs(html);
    return [...new Set(hrefs)];
};

/* read domains from the domains.txt */
const readDomains = async () => {
    let domains = [];
    fs.readFileSync("./src/domains.txt", "utf-8")
        .split(/\r?\n/)
        .forEach(function (line) {
            domains.push(line);
        });

    return [...new Set(domains)];
};

/* check if link product has button add-to-cart */
const hasAddToCart = async (domain, url) => {
    try {
        let link = encodeURI(url);
        if (!link.includes("http")) link = `http://${domain}${url}`;
        let response = await fetch(link, { timeout: 10000 });
        let html = await response.text();
        let root = HTMLParser.parse(html);
        if (root.querySelector("button[name='add-to-cart']")) {
            return [true, "button[name='add-to-cart']"];
        }
        if (
            root.querySelector(
                "button[class='single_add_to_cart_button button alt']"
            )
        ) {
            return [
                true,
                "button[class='single_add_to_cart_button button alt']",
            ];
        }
        return [false];
    } catch (error) {
        return [false];
    }
};

/* check if domain has done the task or not */
const isExist = (domain) => {
    let error = fs.readFileSync("./src/error.txt", "utf8");
    if (error.includes(domain)) return true;
    let found = fs.readFileSync("./src/found.txt", "utf8");
    if (found.includes(domain)) return true;
    let noExist = fs.readFileSync("./src/no_exist.txt", "utf8");
    if (noExist.includes(domain)) return true;
    return false;
};

/* Write data to file, cache it to regex later on */
const write = (type, data) => {
    // if (isExist(data)) return;
    fs.appendFile(`./src/${type}.txt`, `\n${data}`, function (err) {
        // if (err) console.log("ERROR WRITE");
    });
};

/* check API work with the link */
const hasAPILink = async (url) => {
    try {
        const response = await fetch(url, { timeout: 20000 });
        const json = await response.json();
        return json[0]["link"];
    } catch (error) {
        return false;
    }
};

/* to reduce the link need to check, that will help performance */
const setupLoop = (arr) => {
    let start;
    let end;
    if (arr.length < 70) {
        start = Math.floor(arr.length / 10);
        end = arr.length;
        return [start, end];
    } else if (arr.length < 150) {
        start = Math.floor(arr.length / 5);
        end = arr.length;
        return [start, end];
    } else {
        start = Math.floor(arr.length / 3);
        end = Math.floor((arr.length * 9) / 10);
        return [start, end];
    }
};

/* use to extract data */
const purifyGates = async (arr) => {
    let res = [];
    for (let i = 0; i < arr.length; i++) {
        let pGate = arr[i].split(" ")[1];
        if (pGate.includes("method_bacs")) {
            res.push("method_bacs");
            continue;
        } else if (pGate.includes("method_cod")) {
            res.push("method_cod");
            continue;
        } else if (pGate.includes("momo")) {
            res.push("momo");
            continue;
        } else if (pGate.includes("paypal")) {
            res.push("paypal");
            continue;
        } else if (pGate.includes("onepay")) {
            res.push("onepay");
            continue;
        } else if (pGate.includes("vtcpay")) {
            res.push("vtcpay");
            continue;
        } else if (pGate.includes("vnpay")) {
            res.push("vnpay");
            continue;
        } else if (pGate.includes("nganluong")) {
            res.push("ngangluong");
            continue;
        } else if (pGate.includes("123pay")) {
            res.push("123pay");
            continue;
        } else if (pGate.includes("zalopay")) {
            res.push("zalopay");
            continue;
        } else if (pGate.includes("baokim")) {
            res.push("baokim");
            continue;
        } else if (pGate.includes("smartlink")) {
            res.push("smartlink");
            continue;
        } else if (pGate.includes("cheque")) {
            res.push("cheque");
            continue;
        } else if (pGate.includes("alepay")) {
            res.push("alepay");
            continue;
        } else if (pGate.includes("airpay")) {
            res.push("airpay");
            continue;
        } else {
            res.push(pGate);
        }
    }
    return res;
};

module.exports = {
    addToCart,
    cart,
    checkout,
    getAllHrefs,
    readDomains,
    hasAddToCart,
    isExist,
    write,
    hasAPILink,
    setupLoop,
    purifyGates,
};
