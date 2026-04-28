// background.js — service worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("Pinterest Board Downloader instalado!");
});

// Relay messages between popup and content scripts if needed
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "scrollProgress") {
    // Forward to popup if open
    chrome.runtime.sendMessage(msg).catch(() => {});
  }
});
