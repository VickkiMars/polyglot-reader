import fs from "fs";

async function main() {
  console.log("Connecting to Chrome on port 9222...");
  const newTabRes = await fetch("http://localhost:9222/json/new?https://polyglot-reader-nine.vercel.app", {
    method: "PUT",
  });
  const page = await newTabRes.json();
  const wsUrl = page.webSocketDebuggerUrl;
  console.log("Opened tab:", page.id, wsUrl);

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
  await send("Runtime.enable");
  await send("DOM.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log("Waiting for page load...");
  await new Promise((r) => setTimeout(r, 3500));

  // Click install/offline button in header
  console.log("Opening InstallOfflineModal...");
  const clickResult = await send("Runtime.evaluate", {
    expression: `(() => {
      const btn = document.querySelector('button[aria-label="Install App and Offline Audio"]');
      if (btn) {
        btn.click();
        return "Clicked button";
      }
      return "Button not found";
    })()`,
  });
  console.log("Open modal result:", clickResult?.result?.value);

  await new Promise((r) => setTimeout(r, 1200));

  // Check modal contents
  const modalCheck = await send("Runtime.evaluate", {
    expression: `(() => {
      const modal = document.querySelector('div[role="dialog"]');
      if (!modal) return "No modal found";
      const headings = Array.from(modal.querySelectorAll('h2, h3, button')).map(el => el.textContent.trim());
      return headings.join(" | ");
    })()`,
  });
  console.log("Modal elements:", modalCheck?.result?.value);

  // Click Download button
  console.log("Starting download...");
  const startDlResult = await send("Runtime.evaluate", {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const dlBtn = buttons.find(b => b.textContent.includes('Download') || b.textContent.includes('Resume'));
      if (dlBtn) {
        dlBtn.click();
        return "Clicked: " + dlBtn.textContent.trim();
      }
      return "Download button not found";
    })()`,
  });
  console.log("Download click result:", startDlResult?.result?.value);

  // Monitor progress for 12 seconds
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const status = await send("Runtime.evaluate", {
      expression: `(() => {
        const text = document.body.innerText;
        const progressEl = document.querySelector('div[role="progressbar"]') || document.querySelector('[class*="bg-[var(--md-sys-color-primary)]"]');
        const errEl = document.querySelector('[class*="border-[var(--md-sys-color-error)"]');
        
        // Find percentage text like "34%" or "12 / 206"
        const matches = text.match(/(\\d+\\.?\\d*\\s*%|\\d+\\s*\\/\\s*\\d+\\s*files|\\d+\\.?\\d*\\s*MB\\/s)/gi);
        return {
          hasError: !!errEl,
          matches: matches ? matches.slice(0, 5) : [],
          progressText: (document.querySelector('div[role="dialog"]')?.innerText || "").slice(0, 300)
        };
      })()`,
      returnByValue: true,
    });
    console.log(`[Tick ${i + 1}] Status:`, JSON.stringify(status?.result?.value));
  }

  // Take screenshot
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(
    "/home/kami/.gemini/antigravity/brain/67863077-e704-4232-9487-caf48168212e/production_live_download.png",
    Buffer.from(shot.data, "base64")
  );
  console.log("Saved production_live_download.png");

  // Close tab
  await send("Page.close");
  ws.close();
  console.log("Done verification!");
}

main().catch(console.error);
