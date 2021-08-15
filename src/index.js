const puppeteer = require("puppeteer");
const helper = require("./helper.js");
const query = require("./query");

const setupBrowser = async () => {
    let browser = await puppeteer.launch({
        headless: true,
    });

    // browser.on("targetcreated", async (target) => {
    //     if (target.type() === "page") {
    //         let page = await target.page();
    //         let url = page.url();
    //         if (url.search("site.com") == -1) {
    //             await page.close();
    //         }
    //     }
    // });
    return browser;
};

const setupPage = async (browser) => {
    let page = await browser.newPage();
    page.on("dialog", async (dialog) => {
        await dialog.dismiss();
    });
    return page;
};

const gotoCheckout = async (page) => {
    try {
        await Promise.all([
            page.click("[class='checkout-button button alt wc-forward']"),
            page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        ]);
    } catch (error) {
        let url = page.url();
        let hrefs = await helper.getAllHrefs(url);
        let checkoutlink = await helper.checkout(hrefs);
        if (!checkoutlink) return false;
        await page.goto(checkoutlink, { waitUntil: "domcontentloaded" });
    }
    return page;
};

const gotoCart = async (page) => {
    let url = page.url();
    let hrefs = await helper.getAllHrefs(url);
    let cartLink = await helper.cart(hrefs);
    if (!cartLink) return false;
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
    } catch (error) {
        return false;
    }
    return result;
};

const finalStep = async (domain, page) => {
    let page1 = await gotoCart(page);
    if (!page1) return false;
    let page2 = await gotoCheckout(page1);
    if (!page2) return false;
    let res = await result(page2);
    return res;
};

const flow1 = async (domain, page) => {
    let url = `http://${domain}/wp-json/wp/v2/product`;
    let linkAPI = await helper.hasAPILink(url);
    if (!linkAPI) return false;
    let checked = await helper.hasAddToCart(linkAPI);
    if (!checked[0]) return false; // should return something to ended immediately
    await page.goto(linkAPI, { waitUntil: "domcontentloaded" });
    await Promise.all([
        page.click(checked[1]),
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    ]);
    let res = await finalStep(domain, page);
    return res;
};

const flow2 = async (domain, page) => {
    let url = `http://${domain}/`;
    let hrefs = await helper.getAllHrefs(url);
    hrefs = [...new Set(hrefs)];
    hrefs = hrefs.filter((href) => href.includes("http"));
    let [start, end] = helper.setupLoop(hrefs);
    let nextlink = "";
    for (let i = start; i < end; i++) {
        checked = await helper.hasAddToCart(hrefs[i]);
        if (checked[0]) {
            nextlink = hrefs[i];
            break;
        }
    }
    if (!nextlink) return false;

    await page.goto(nextlink, {
        waitUntil: "domcontentloaded",
    });
    await Promise.all([
        page.click(checked[1]),
        page.waitForNavigation({ timeout: 15000 }),
    ]);
    let res = await finalStep(domain, page);
    return res;
};

const main = async () => {
    // let domains = await helper.readDomains();
    let domains = ["vietnamnay.com"];
    let browser = await setupBrowser();
    let page = await setupPage(browser);
    for (let i = 0; i < domains.length; i++) {
        try {
            // if (helper.isExist(domains[i])) continue;
            let resFlow1 = await flow1(domains[i], page);
            if (resFlow1) {
                // insert into database
                let id = await query.insertDomain(
                    domains[i],
                    resFlow1.length,
                    "woocommerce"
                );
                for (let i = 0; i < resFlow1.length; i++) {
                    await query.insertGates(id, resFlow1[i]);
                }
                helper.write("found", domains[i]);
                console.log(`${i}: ${domains[i]} Found`);
                continue;
            }
            let resFlow2 = await flow2(domains[i], page);
            if (resFlow2) {
                // insert into database
                let id = await query.insertDomain(
                    domains[i],
                    resFlow2.length,
                    "woocommerce"
                );
                for (let i = 0; i < resFlow2.length; i++) {
                    await query.insertGates(id, resFlow2[i]);
                }
                helper.write("found", domains[i]);
                console.log(`${i}: ${domains[i]} Found`);
                continue;
            }
            await query.insertDomain(domains[i], 0, "woocommerce");
            console.log(`${i}: ${domain}: not_exist`);
            helper.write("no_exist", domains[i]);
        } catch (error) {
            await query.insertDomain(domains[i], null, "woocommerce");
            console.log(`${i}: ${domains[i]} MET ERROR`);
            helper.write("error", domains[i]);
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
