const puppeteer = require("puppeteer");
const helper = require("./helper.js");
const query = require("./query");

const setupBrowser = async () => {
    let browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox"],
    });
    return browser;
};

const setupPage = async (browser) => {
    let page = await browser.newPage();
    // browser.on("targetcreated", async (target) => {
    //  if (target.type() === "page") {
    //    let page = await target.page();
    //  let url = page.url();
    //  if (url.search("site.com") == -1) {
    //    await page.close();
    // }
    // }
    // });
    page.setDefaultNavigationTimeout(60000);
    await page.setRequestInterception(true);
    page.on("request", (req) => {
        if (
            req.resourceType() == "video" ||
            req.resourceType() == "font" ||
            req.resourceType() == "image"
        ) {
            req.abort();
        } else {
            req.continue();
        }
    });
    return page;
};

const hasOptions = async (page) => {
    try {
        let optionClass = "";
        let a = await page.evaluate(() => {
            let res = document.querySelector("td > div > div");
            if (!res) res = document.querySelector("td > ul > li");
            return res.className;
        });
        optionClass = `[class='${a}']`;
        return optionClass;
    } catch (error) {
        return false;
    }
};
const gotoCheckout = async (page) => {
    try {
        await Promise.all([
            page.click("[class='checkout-button button alt wc-forward']"),
            page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        ]);
    } catch (error) {
        let url = await page.url();
        let hrefs = await helper.getAllHrefs(url);
        let checkoutlink = await helper.checkout(hrefs);
        if (!checkoutlink) return false;
        await page.goto(checkoutlink, { waitUntil: "domcontentloaded" });
    }
    return page;
};

const gotoCart = async (domain, page) => {
    let url = await page.url();
    let hrefs = await helper.getAllHrefs(url);
    let cartLink = await helper.cart(hrefs);
    if (!cartLink) return false;
    if (!cartLink.includes("http")) cartLink = `http://${domain}${cartLink}`;
    await page.goto(cartLink, { waitUntil: "domcontentloaded" });
    return page;
};

const result = async (page) => {
    let result;
    try {
        let arr_gates = await page.evaluate(() => {
            let data = [];
            let ele = document.querySelectorAll("#payment > ul > li");
            for (let i = 0; i < ele.length; i++) {
                data.push(ele[i].className);
            }
            return data;
        });
        result = await helper.purifyGates(arr_gates);
        return result;
    } catch (error) {
        return false;
    }
};

const finalStep = async (domain, page) => {
    let page1 = await gotoCart(domain, page);
    if (!page1) return false;
    let page2 = await gotoCheckout(page1);
    if (!page2) return false;
    let res = await result(page2);
    return res;
};

const flow1 = async (domain, page) => {
    let url = `http://${domain}/`;
    let hrefs = await helper.getAllHrefs(url);
    hrefs = [...new Set(hrefs)];
    let nextlink = await helper.addToCart(hrefs);
    if (!nextlink) return false;
    if (!nextlink.includes("http")) nextlink = `${url}${nextlink}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.goto(nextlink, { waitUntil: "domcontentloaded" });
    let res = finalStep(domain, page);
    return res;
};

const flow2 = async (domain, page) => {
    let url = `http://${domain}/wp-json/wp/v2/product`;
    let linkAPI = await helper.hasAPILink(url);
    if (!linkAPI) return false;
    let checked = await helper.hasAddToCart(domain, linkAPI);
    if (!checked[0]) return false; // should return something to ended immediately
    await page.goto(linkAPI, { waitUntil: "domcontentloaded" });
    let option = await hasOptions(page);
    if (option) {
        await page.click(option);
    }
    await page.waitForSelector(checked[1]);
    await Promise.all([
        page.click(checked[1]),
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    ]);
    let res = await finalStep(domain, page);
    return res;
};

const flow3 = async (domain, page) => {
    let url = `http://${domain}/`;
    let hrefs = await helper.getAllHrefs(url);
    hrefs = [...new Set(hrefs)];
    // hrefs = hrefs.filter((href) => href.includes("http"));
    let checkCart = await helper.cart(hrefs);
    if (!checkCart) return false;
    let [start, end] = helper.setupLoop(hrefs);
    console.log(end - start);
    let nextlink = "";
    for (let i = start; i < end; i++) {
        console.log(hrefs[i]);
        checked = await helper.hasAddToCart(domain, hrefs[i]);
        if (checked[0]) {
            nextlink = hrefs[i];
            break;
        }
    }
    if (!nextlink) return false;
    if (!nextlink.includes("http")) nextlink = `http://${domain}${nextlink}`;
    await page.goto(nextlink, {
        waitUntil: "domcontentloaded",
    });
    let option = await hasOptions(page);
    if (option) {
        await page.click(option);
    }
    await Promise.all([
        page.click(checked[1]),
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    ]);
    let res = await finalStep(domain, page);
    return res;
};

const insertData = async (data, domain) => {
    let id = await query.insertDomain(domain, data.length, "woocommerce");
    for (let i = 0; i < data.length; i++) {
        await query.insertGates(id, data[i]);
    }
};

// const closePage = async (browser) => {
//     let pages = await browser.pages();
//     if (pages.length < 2) return;
//     for (let i = 2; i < pages.length; i++) {
//         await pages[i].close();
//     }
//     return;
// };

const main = async () => {
    let domains = await helper.readDomains();
    // let domains = ["dienmaygiadinh.com.vn"];
    let browser = await setupBrowser();
    let page = await setupPage(browser);
    for (let i = 0; i < domains.length; i++) {
        try {
            if (helper.isExist(domains[i])) continue;
            console.log(`running: ${domains[i]}`);
            let resFlow1 = await flow1(domains[i], page);
            if (resFlow1) {
                console.log(resFlow1);
                // insert into database
                // await insertData(resFlow1, domains[i]);
                // await closePage(browser);
                helper.write("found", domains[i]);
                console.log(`${i}: ${domains[i]} Found`);
                continue;
            }

            let resFlow2 = await flow2(domains[i], page);
            if (resFlow2) {
                console.log(resFlow2);
                // insert into database
                // await insertData(resFlow2, domains[i]);
                // await closePage(browser);
                helper.write("found", domains[i]);
                console.log(`${i}: ${domains[i]} Found`);
                continue;
            }
            // let resFlow3 = await flow3(domains[i], page);
            // if (resFlow3) {
            //     console.log(resFlow3);
            //     // insert into database
            //     // await insertData(resFlow3, domains[i]);
            //     // await closePage(browser);
            //     helper.write("found", domains[i]);
            //     console.log(`${i}: ${domains[i]} Found`);
            //     continue;
            // }
            await query.insertDomain(domains[i], 0, "woocommerce");
            // await closePage(browser);
            helper.write("no_exist", domains[i]);
            console.log(`${i}: ${domains[i]}: not_exist`);
        } catch (error) {
            console.log(error);
            await query.insertDomain(domains[i], null, "woocommerce");
            // await closePage(browser);
            helper.write("error", domains[i]);
            console.log(`${i}: ${domains[i]} MET ERROR`);
            continue;
        }
    }
    await browser.close();
    return;
};

(async () => {
    let start = new Date();
    let hrstart = process.hrtime();
    await main();
    let end = new Date() - start;
    let hrend = process.hrtime(hrstart);
    console.log(`Execution time (hr): ${hrend[0]}`);
    return;
})();
