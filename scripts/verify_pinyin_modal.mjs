import fs from "fs";

async function main() {
  const newTab = await fetch("http://localhost:9222/json/new?http://localhost:3000", { method: "PUT" });
  const page = await newTab.json();
  const wsUrl = page.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      callbacks.get(data.id)(data.result);
      callbacks.delete(data.id);
    }
  };

  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const msgId = id++;
      callbacks.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  };

  await new Promise((r) => (ws.onopen = r));

  await send("Page.enable");
  await send("DOM.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1200,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log("Navigating to http://localhost:3000...");
  await new Promise((r) => setTimeout(r, 2000));

  // 1. Scroll first lesson card and click it
  console.log("Scrolling and clicking first lesson card...");
  await send("Runtime.evaluate", {
    expression: "document.querySelector('article').scrollIntoView({ behavior: 'instant', block: 'center' });",
  });
  await new Promise((r) => setTimeout(r, 500));

  const box = await send("Runtime.evaluate", {
    expression: "(() => { const r = document.querySelector('article').getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()",
    returnByValue: true,
  });
  const { x, y } = box.result.value;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });

  // Wait for story detail to load in modal
  await new Promise((r) => setTimeout(r, 2000));

  // 2. Capture Pinyin On screenshot
  console.log("Capturing Pinyin On screenshot...");
  const shot1 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("/home/kami/.gemini/antigravity/brain/6a31e484-518a-4224-87c9-8bdecb7d844c/modal_pinyin_on.png", Buffer.from(shot1.data, "base64"));

  // Check state of Pinyin button and rt visibility
  const eval1 = await send("Runtime.evaluate", {
    expression: "(() => {\n" +
      "  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Pinyin'));\n" +
      "  const rt = document.querySelector('rt');\n" +
      "  const rtVisible = rt ? window.getComputedStyle(rt).display !== 'none' : false;\n" +
      "  return { btnText: btn ? btn.textContent.trim() : null, rtVisible, rtText: rt ? rt.textContent : null };\n" +
      "})()",
    returnByValue: true,
  });
  console.log("Pinyin On state check:", eval1.result?.value);

  // 3. Click Pinyin On -> Pinyin Off
  console.log("Clicking Pinyin toggle to turn Off...");
  await send("Runtime.evaluate", {
    expression: "(() => {\n" +
      "  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Pinyin'));\n" +
      "  if (btn) btn.click();\n" +
      "})()",
  });
  await new Promise((r) => setTimeout(r, 600));

  const shot2 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("/home/kami/.gemini/antigravity/brain/6a31e484-518a-4224-87c9-8bdecb7d844c/modal_pinyin_off.png", Buffer.from(shot2.data, "base64"));

  const eval2 = await send("Runtime.evaluate", {
    expression: "(() => {\n" +
      "  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Pinyin'));\n" +
      "  const rt = document.querySelector('rt');\n" +
      "  const rtVisible = rt ? window.getComputedStyle(rt).display !== 'none' : false;\n" +
      "  return { btnText: btn ? btn.textContent.trim() : null, rtVisible };\n" +
      "})()",
    returnByValue: true,
  });
  console.log("Pinyin Off state check:", eval2.result?.value);

  // 4. Click Space On -> Space Off
  console.log("Clicking Space toggle...");
  await send("Runtime.evaluate", {
    expression: "(() => {\n" +
      "  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Space'));\n" +
      "  if (btn) btn.click();\n" +
      "})()",
  });
  await new Promise((r) => setTimeout(r, 600));
  const shot3 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("/home/kami/.gemini/antigravity/brain/6a31e484-518a-4224-87c9-8bdecb7d844c/modal_space_off.png", Buffer.from(shot3.data, "base64"));

  // 5. Click Vocabulary tab
  console.log("Clicking Vocabulary tab...");
  await send("Runtime.evaluate", {
    expression: "(() => {\n" +
      "  const tab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Vocabulary'));\n" +
      "  if (tab) tab.click();\n" +
      "})()",
  });
  await new Promise((r) => setTimeout(r, 600));
  const shot4 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("/home/kami/.gemini/antigravity/brain/6a31e484-518a-4224-87c9-8bdecb7d844c/modal_vocab_tab.png", Buffer.from(shot4.data, "base64"));

  console.log("Verification completed successfully!");
  process.exit(0);
}

main().catch(console.error);
