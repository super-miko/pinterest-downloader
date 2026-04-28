// content.js — injected into Pinterest pages

(function () {
  let collecting = false;

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "getImages") {
      const images = collectImages();
      sendResponse({ images });
    }

    if (msg.action === "scrollAndCollect") {
      autoScroll(sendResponse);
      return true; // async
    }

    if (msg.action === "ping") {
      sendResponse({ ok: true, url: location.href });
    }
  });

  function collectImages() {
    const seen = new Set();
    const results = [];

    // Collect from all img tags
    document.querySelectorAll("img").forEach((img) => {
      let src = img.src || img.dataset.src || "";
      src = upgradeUrl(src);
      if (src && !seen.has(src) && isPinterestImage(src)) {
        seen.add(src);
        const alt = img.alt || "";
        results.push({ url: src, alt });
      }
    });

    // Also look in background images of divs
    document.querySelectorAll("[style]").forEach((el) => {
      const style = el.getAttribute("style") || "";
      const match = style.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/);
      if (match) {
        let src = upgradeUrl(match[1]);
        if (src && !seen.has(src) && isPinterestImage(src)) {
          seen.add(src);
          results.push({ url: src, alt: "" });
        }
      }
    });

    // Look inside data attributes used by Pinterest's React render
    document.querySelectorAll("[data-test-id='pin-image']").forEach((el) => {
      const img = el.querySelector("img");
      if (img) {
        let src = upgradeUrl(img.src || img.dataset.src || "");
        if (src && !seen.has(src) && isPinterestImage(src)) {
          seen.add(src);
          results.push({ url: src, alt: img.alt || "" });
        }
      }
    });

    return results;
  }

  function upgradeUrl(url) {
    if (!url) return "";
    // Upgrade to highest resolution: replace /236x/, /474x/, /736x/ with /originals/
    // Pinterest image URL patterns: https://i.pinimg.com/236x/... or https://i.pinimg.com/736x/...
    url = url.replace(/\/\d+x(?:\/|$)/g, "/originals/");
    // Remove query strings that might cause CORS issues
    try {
      const u = new URL(url);
      u.search = "";
      return u.toString();
    } catch {
      return url;
    }
  }

  function isPinterestImage(url) {
    return (
      url.includes("pinimg.com") &&
      !url.includes("favicon") &&
      !url.includes("logo") &&
      (url.match(/\.(jpg|jpeg|png|webp|gif)/i) || url.includes("/originals/"))
    );
  }

  async function autoScroll(sendResponse) {
    if (collecting) {
      sendResponse({ done: true });
      return;
    }
    collecting = true;

    const totalScrolls = 15;
    const scrollDelay = 1200;
    let i = 0;

    const tick = () => {
      window.scrollTo(0, document.body.scrollHeight);
      i++;
      chrome.runtime.sendMessage({
        action: "scrollProgress",
        step: i,
        total: totalScrolls,
      });
      if (i < totalScrolls) {
        setTimeout(tick, scrollDelay);
      } else {
        collecting = false;
        const images = collectImages();
        sendResponse({ done: true, images });
      }
    };

    tick();
  }
})();
