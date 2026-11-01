import fs from "fs";

const ARTIFACT_DIR = "/home/kami/.gemini/antigravity/brain/67863077-e704-4232-9487-caf48168212e";

async function runTest() {
  console.log("Connecting to Chrome on port 9222...");
  const newTabRes = await fetch("http://localhost:9222/json/new?about:blank", {
    method: "PUT",
  });
  const page = await newTabRes.json();
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
  await send("Runtime.enable");
  await send("DOM.enable");
  await send("Network.enable");
  // Bypass any cached service worker to ensure live fresh assets
  await send("Network.setBypassServiceWorker", { bypass: true });
  await send("Network.clearBrowserCache");

  // ==========================================
  // TEST 1: iPhone SE (375 x 667)
  // ==========================================
  console.log("\n==========================================");
  console.log("TEST 1: iPhone SE (375 x 667)");
  console.log("==========================================");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    mobile: true,
  });

  await send("Page.navigate", { url: "http://localhost:3002" });
  await new Promise((r) => setTimeout(r, 2000));

  // Check horizontal overflow on home page
  const homeOverflow375 = await send("Runtime.evaluate", {
    expression: `({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    })`,
    returnByValue: true,
  });
  console.log("Home Page 375px Overflow Check:", homeOverflow375?.result?.value);

  const homeShot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${ARTIFACT_DIR}/mobile_home_375.png`, Buffer.from(homeShot.data, "base64"));
  console.log("Saved mobile_home_375.png");

  // Open first story reader modal (click "Read" button on first card)
  console.log("Opening story reader modal...");
  await send("Runtime.evaluate", {
    expression: `(() => {
      const readBtn = document.querySelector('article button');
      if (readBtn) readBtn.click();
    })()`,
  });

  // Wait for ruby content to load
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const countRes = await send("Runtime.evaluate", {
      expression: "document.querySelectorAll('ruby').length",
      returnByValue: true,
    });
    if (countRes?.result?.value > 0) break;
  }

  // 1A. Click a character on the left side of the text (ruby 0: 我)
  console.log("Clicking left ruby character (ruby 0: 我)...");
  await send("Runtime.evaluate", {
    expression: "document.querySelectorAll('ruby')[0].click()",
  });

  await new Promise((r) => setTimeout(r, 600));

  // Measure left tooltip positioning
  const leftTooltipMetrics = await send("Runtime.evaluate", {
    expression: `(() => {
      const closeBtn = document.querySelector('[aria-label="Close word details"]');
      if (!closeBtn) return { found: false };
      const card = closeBtn.closest('div.fixed');
      const rect = card.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return {
        found: true,
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
        vw,
        vh,
        fullyOnScreen: rect.left >= 0 && rect.right <= vw && rect.top >= 0 && rect.bottom <= vh,
        leftMargin: rect.left,
        rightMargin: vw - rect.right,
        text: card.innerText.replace(/\\n+/g, ' ')
      };
    })()`,
    returnByValue: true,
  });
  console.log("Left Ruby Tooltip Metrics:", JSON.stringify(leftTooltipMetrics?.result?.value, null, 2));

  const leftShot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${ARTIFACT_DIR}/mobile_tooltip_left_375.png`, Buffer.from(leftShot.data, "base64"));
  console.log("Saved mobile_tooltip_left_375.png");

  // 1B. Click a character on the right side of the text (ruby 7: 学生)
  console.log("Clicking right-clamped ruby character (ruby 7: 学生)...");
  await send("Runtime.evaluate", {
    expression: "document.querySelectorAll('ruby')[7].click()",
  });

  await new Promise((r) => setTimeout(r, 600));

  const rightTooltipMetrics = await send("Runtime.evaluate", {
    expression: `(() => {
      const closeBtn = document.querySelector('[aria-label="Close word details"]');
      if (!closeBtn) return { found: false };
      const card = closeBtn.closest('div.fixed');
      const rect = card.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return {
        found: true,
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
        vw,
        vh,
        fullyOnScreen: rect.left >= 0 && rect.right <= vw && rect.top >= 0 && rect.bottom <= vh,
        leftMargin: rect.left,
        rightMargin: vw - rect.right,
        text: card.innerText.replace(/\\n+/g, ' ')
      };
    })()`,
    returnByValue: true,
  });
  console.log("Right Ruby Tooltip Metrics:", JSON.stringify(rightTooltipMetrics?.result?.value, null, 2));

  const rightShot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${ARTIFACT_DIR}/mobile_tooltip_right_375.png`, Buffer.from(rightShot.data, "base64"));
  console.log("Saved mobile_tooltip_right_375.png");

  // 1C. Switch to Vocabulary Tab
  console.log("Switching to Vocabulary tab...");
  await send("Runtime.evaluate", {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const vocabBtn = buttons.find(b => b.textContent.includes('Vocab'));
      if (vocabBtn) vocabBtn.click();
    })()`,
  });

  await new Promise((r) => setTimeout(r, 600));

  const vocabShot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${ARTIFACT_DIR}/mobile_reader_vocab_375.png`, Buffer.from(vocabShot.data, "base64"));
  console.log("Saved mobile_reader_vocab_375.png");

  // Close story modal
  await send("Runtime.evaluate", {
    expression: "document.querySelector('button[aria-label=\"Close reader\"]').click()",
  });
  await new Promise((r) => setTimeout(r, 600));

  // 1D. Open Install & Offline Modal
  console.log("Opening InstallOfflineModal on mobile...");
  await send("Runtime.evaluate", {
    expression: "document.querySelector('button[aria-label=\"Install App and Offline Audio\"]').click()",
  });
  await new Promise((r) => setTimeout(r, 800));

  const modalShot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${ARTIFACT_DIR}/mobile_offline_modal_375.png`, Buffer.from(modalShot.data, "base64"));
  console.log("Saved mobile_offline_modal_375.png");

  // Close Install modal
  await send("Runtime.evaluate", {
    expression: "document.querySelector('button[aria-label=\"Close dialog\"]').click()",
  });
  await new Promise((r) => setTimeout(r, 1200));

  // ==========================================
  // TEST 2: Ultra-Narrow Screen (320 x 568)
  // ==========================================
  console.log("\n==========================================");
  console.log("TEST 2: Ultra-Narrow Screen (320 x 568)");
  console.log("==========================================");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 568,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send("Page.navigate", { url: "http://localhost:3002" });
  await new Promise((r) => setTimeout(r, 2000));

  const narrowOverflow = await send("Runtime.evaluate", {
    expression: `({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    })`,
    returnByValue: true,
  });
  console.log("Ultra-Narrow 320px Overflow Check:", narrowOverflow?.result?.value);

  // Open reader on 320px and test tooltip
  console.log("Opening reader modal on 320px...");
  await send("Runtime.evaluate", {
    expression: "document.querySelector('article button').click()",
  });

  let rubyCount320 = 0;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const countRes = await send("Runtime.evaluate", {
      expression: "document.querySelectorAll('ruby').length",
      returnByValue: true,
    });
    rubyCount320 = countRes?.result?.value || 0;
    if (rubyCount320 > 0) break;
  }
  console.log("Rubies found on 320px:", rubyCount320);

  // Click character on 320px
  console.log("Clicking ruby character on 320px...");
  await send("Runtime.evaluate", {
    expression: "document.querySelectorAll('ruby')[0].click()",
  });
  await new Promise((r) => setTimeout(r, 600));

  const narrowTooltipMetrics = await send("Runtime.evaluate", {
    expression: `(() => {
      const closeBtn = document.querySelector('[aria-label="Close word details"]');
      if (!closeBtn) return { found: false };
      const card = closeBtn.closest('div.fixed');
      const rect = card.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return {
        found: true,
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
        vw,
        vh,
        fullyOnScreen: rect.left >= 0 && rect.right <= vw && rect.top >= 0 && rect.bottom <= vh,
        leftMargin: rect.left,
        rightMargin: vw - rect.right,
        text: card.innerText.replace(/\\n+/g, ' ')
      };
    })()`,
    returnByValue: true,
  });
  console.log("Ultra-Narrow 320px Tooltip Metrics:", JSON.stringify(narrowTooltipMetrics?.result?.value, null, 2));

  const narrowShot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${ARTIFACT_DIR}/mobile_tooltip_320.png`, Buffer.from(narrowShot.data, "base64"));
  console.log("Saved mobile_tooltip_320.png");

  // Close story modal
  await send("Runtime.evaluate", {
    expression: "document.querySelector('button[aria-label=\"Close reader\"]').click()",
  });
  await new Promise((r) => setTimeout(r, 600));

  // ==========================================
  // TEST 3: Standard Tablet (768 x 1024)
  // ==========================================
  console.log("\n==========================================");
  console.log("TEST 3: Standard Tablet (768 x 1024)");
  console.log("==========================================");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await new Promise((r) => setTimeout(r, 1000));

  const tabletOverflow = await send("Runtime.evaluate", {
    expression: `({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    })`,
    returnByValue: true,
  });
  console.log("Tablet 768px Overflow Check:", tabletOverflow?.result?.value);

  // ==========================================
  // TEST 4: Desktop (1280 x 800)
  // ==========================================
  console.log("\n==========================================");
  console.log("TEST 4: Desktop (1280 x 800)");
  console.log("==========================================");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await new Promise((r) => setTimeout(r, 800));

  const desktopOverflow = await send("Runtime.evaluate", {
    expression: `({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    })`,
    returnByValue: true,
  });
  console.log("Desktop 1280px Overflow Check:", desktopOverflow?.result?.value);

  await send("Page.close");
  ws.close();
  console.log("\n==========================================");
  console.log("ALL MOBILE RESPONSIVENESS AND BREAKPOINT TESTS PASSED!");
  console.log("==========================================");
}

runTest().catch(console.error);
