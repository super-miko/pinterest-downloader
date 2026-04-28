// popup.js

const $ = (id) => document.getElementById(id);

let currentTab = null;
let allImages = [];
let isRunning = false;

// ─── Init ───────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  const url = tab?.url || "";
  const isPinterest = url.includes("pinterest.com");

  if (!isPinterest) {
    $("main-content").style.display = "none";
    $("not-pinterest").style.display = "block";
    return;
  }

  $("page-url").textContent = url;

  // Ping content script and get initial images
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch (_) {}

  refreshImages();

  $("btn-start").addEventListener("click", startDownload);
  $("btn-scroll").addEventListener("click", doAutoScroll);

  // Listen to scroll progress from content
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "scrollProgress") {
      log(`📜 Rolando... ${msg.step}/${msg.total}`, "info");
    }
  });
});

// ─── Refresh image count ─────────────────────────────────────────────────────

async function refreshImages() {
  try {
    const response = await chrome.tabs.sendMessage(currentTab.id, {
      action: "getImages",
    });
    allImages = response?.images || [];
    $("found-count").textContent = allImages.length;
    $("btn-scroll").style.display = "block";
  } catch (e) {
    log("Não foi possível comunicar com a página. Recarregue a aba.", "err");
  }
}

// ─── Auto Scroll ─────────────────────────────────────────────────────────────

async function doAutoScroll() {
  if (isRunning) return;
  isRunning = true;

  $("btn-scroll").disabled = true;
  $("btn-start").disabled = true;
  setStatus("running", "Rolando...");
  $("log-box").style.display = "block";
  log("🔄 Iniciando rolagem automática para carregar mais pins...", "info");
  $("tip-text").textContent = "Rolando a página para carregar todas as imagens...";

  try {
    const response = await chrome.tabs.sendMessage(currentTab.id, {
      action: "scrollAndCollect",
    });

    allImages = response?.images || [];
    $("found-count").textContent = allImages.length;
    log(`✅ Rolagem concluída! ${allImages.length} imagens encontradas.`, "ok");
    setStatus("idle", "Pronto");
  } catch (e) {
    log("Erro ao rolar: " + e.message, "err");
    setStatus("error", "Erro");
  }

  $("btn-scroll").disabled = false;
  $("btn-start").disabled = false;
  $("tip-text").textContent = "Agora clique em 'Baixar Pasta como ZIP'!";
  isRunning = false;
}

// ─── Main Download ────────────────────────────────────────────────────────────

async function startDownload() {
  if (isRunning) return;
  isRunning = true;

  $("btn-start").disabled = true;
  $("btn-scroll").style.display = "none";
  $("log-box").style.display = "block";
  $("progress-wrap").style.display = "block";
  setStatus("running", "Baixando...");

  // Refresh images one more time
  try {
    const response = await chrome.tabs.sendMessage(currentTab.id, {
      action: "getImages",
    });
    allImages = response?.images || [];
    $("found-count").textContent = allImages.length;
  } catch (_) {}

  if (allImages.length === 0) {
    log("❌ Nenhuma imagem encontrada. Role a página para carregar pins.", "err");
    setStatus("error", "Sem imagens");
    $("btn-start").disabled = false;
    isRunning = false;
    return;
  }

  log(`📦 Preparando ZIP com ${allImages.length} imagens...`, "info");

  // Get board name from URL
  const urlParts = currentTab.url.split("/").filter(Boolean);
  const boardName =
    urlParts[urlParts.length - 1] ||
    urlParts[urlParts.length - 2] ||
    "pinterest-board";

  const zip = MiniZip.create();

  let done = 0;
  let errors = 0;

  // Download images in batches of 4
  const batchSize = 4;
  for (let i = 0; i < allImages.length; i += batchSize) {
    const batch = allImages.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async ({ url, alt }, batchIdx) => {
        const idx = i + batchIdx;
        const ext = getExt(url);
        const name = sanitize(alt || `pin-${idx + 1}`) + `_${idx + 1}.${ext}`;

        try {
          const blob = await fetchImage(url);
          const arrayBuffer = await blob.arrayBuffer();
          zip.addFile(boardName + "/" + name, new Uint8Array(arrayBuffer));
          done++;
          $("done-count").textContent = done;
          log(`✅ ${name}`, "ok");
        } catch (e) {
          errors++;
          log(`❌ Erro: ${name}`, "err");
        }

        updateProgress(done + errors, allImages.length);
      })
    );

    // Small pause between batches to avoid rate limiting
    await sleep(300);
  }

  log(`\n📁 Gerando arquivo ZIP...`, "info");

  try {
    const blob = zip.toBlob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${boardName}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    log(`\n🎉 ZIP baixado! ${done} imagens, ${errors} erros.`, "ok");
    setStatus("done", `Concluído (${done})`);
    $("tip-text").textContent = `✅ Arquivo ${boardName}.zip baixado!`;
  } catch (e) {
    log("Erro ao gerar ZIP: " + e.message, "err");
    setStatus("error", "Erro no ZIP");
  }

  $("btn-start").disabled = false;
  $("btn-start").innerHTML = `
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    Baixar Novamente`;
  $("btn-scroll").style.display = "block";
  isRunning = false;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchImage(url) {
  // Try direct fetch first
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.blob();
  } catch (_) {
    // Fallback: try without CORS mode
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.blob();
  }
}

function getExt(url) {
  const match = url.match(/\.(jpg|jpeg|png|webp|gif)/i);
  return match ? match[1].toLowerCase() : "jpg";
}

function sanitize(str) {
  return str
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .toLowerCase() || "pin";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function updateProgress(done, total) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  $("progress-bar").style.width = pct + "%";
  $("progress-pct").textContent = pct + "%";
}

function setStatus(type, text) {
  const badge = $("status-badge");
  badge.className = "badge badge-" + type;
  badge.textContent = text;
}

function log(msg, type = "line") {
  const box = $("log-box");
  const div = document.createElement("div");
  div.className = "log-" + type;
  div.textContent = msg;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}
