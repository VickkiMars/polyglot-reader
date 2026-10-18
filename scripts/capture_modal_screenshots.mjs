import fs from "fs";

async function run() {
  const res = await fetch("http://localhost:9222/json/new?http://localhost:3000", { method: "PUT" });
  const page = await res.json();
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
    width: 375,
    height: 812,
    deviceScaleFactor: 2,
    mobile: true,
  });

  await new Promise((r) => setTimeout(r, 1500));

  // 1. Scroll directly to pagination element and screenshot
  await send("Runtime.evaluate", {
    expression: "const nav = document.querySelector('nav[aria-label=\"Pagination Navigation\"]'); if (nav) nav.scrollIntoView({ behavior: 'instant', block: 'center' });",
  });
  await new Promise((r) => setTimeout(r, 600));

  const shot1 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("/home/kami/.gemini/antigravity/brain/4e85aa00-957c-426d-9e87-541f3cb5f03a/mobile_pagination.png", Buffer.from(shot1.data, "base64"));
  console.log("Captured mobile_pagination.png");

  // 2. Click install button to open InstallOfflineModal
  await send("Runtime.evaluate", {
    expression: "window.scrollTo(0, 0); const installBtn = document.querySelector('button[aria-label=\"Install App and Offline Audio\"]'); if (installBtn) installBtn.click();",
  });
  await new Promise((r) => setTimeout(r, 1000));

  const shot2 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("/home/kami/.gemini/antigravity/brain/4e85aa00-957c-426d-9e87-541f3cb5f03a/mobile_install_modal.png", Buffer.from(shot2.data, "base64"));
  console.log("Captured mobile_install_modal.png");

  ws.close();
  await fetch(`http://localhost:9222/json/close/${page.id}`);
  console.log("Done");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
