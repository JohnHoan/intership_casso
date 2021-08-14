const puppeteer = require("puppeteer");
const helper = require("./helper.js");
const fs = require("fs");
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
        result = await page.evaluate(
            () => document.querySelector("#payment").innerHTML
        );
    } catch (error) {
        let url = page.url();
        result = await helper.getHtml(url);
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
    console.log(end - start);
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

const flow3 = async (domain, page) => {
    let url = `http://${domain}/`;
    let hrefs = await helper.getAllHrefs(url);
    hrefs = [...new Set(hrefs)];
    hrefs = hrefs.filter((href) => href.includes("http"));
    let checkLink = "";
    let end = hrefs.length;
    for (let i = 0; i < end; i++) {
        if (hrefs[i].includes("chinh-sach-thanh-toan")) {
            checkLink = hrefs[i];
            break;
        }

        if (hrefs[i].includes("ho-tro-thanh-toan")) {
            checkLink = hrefs[i];
            break;
        }

        if (hrefs[i].includes("phuong-thuc-thanh-toan")) {
            checkLink = hrefs[i];
            break;
        }

        if (hrefs[i].includes("hinh-thuc-thanh-toan")) {
            checkLink = hrefs[i];
            break;
        }

        if (hrefs[i].includes("huong-dan-thanh-toan")) {
            checkLink = hrefs[i];
            break;
        }
    }
    if (!checkLink) return false;
    let res = helper.getHtml(checkLink);
};

const main = async () => {
    let domains = await helper.readDomains();
    // let domains = ["chonmua.com"];
    let browser = await setupBrowser();
    let page = await setupPage(browser);
    for (let i = 0; i < domains.length; i++) {
        try {
            console.log(domains[i]);
            if (fs.existsSync(`./data/${domains[i]}.txt`)) continue;
            if (helper.isExist(domains[i])) continue;
            let resFlow1 = await flow1(domains[i], page);
            if (resFlow1) {
                helper.saveResult(domains[i], resFlow1);
                helper.write("found", domains[i]);
                console.log(`${domains[i]} Found`);
                continue;
            }
            let resFlow2 = await flow2(domains[i], page);
            if (resFlow2) {
                helper.saveResult(domains[i], resFlow2);
                helper.write("found", domains[i]);
                console.log(`${domains[i]} Found`);
                continue;
            }
            let resFlow3 = await flow3(domains[i], page);
            if (resFlow3) {
                helper.saveResult(domains[i], resFlow3);
                helper.write("found", domains[i]);
                console.log(`${domains[i]} Found`);
                continue;
            }
            console.log(`${domain}: not_exist`);
            helper.write("no_exist", domains[i]);
        } catch (error) {
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
    await query.runQuery();
    let end = new Date() - start;
    let hrend = process.hrtime(hrstart);
    console.log(`Execution time (hr): ${hrend[0]}`);
    return;
})();
