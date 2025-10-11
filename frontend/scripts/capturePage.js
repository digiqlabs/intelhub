import { chromium } from "playwright";

async function capture(url, outPath) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleLogs = [];
  page.on("console", (msg) => consoleLogs.push({ type: msg.type(), text: msg.text() }));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  return consoleLogs;
}

async function main() {
  const base = process.argv[2] ?? "http://localhost:5173";
  const routes = ["/wishlist", "/competitors"];
  const results = {};
  for (const route of routes) {
    const output = `screenshots${route.replace(/\//g, "_") || "_home"}.png`;
    const logs = await capture(`${base}${route}`, output);
    results[route] = { screenshot: output, logs };
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
