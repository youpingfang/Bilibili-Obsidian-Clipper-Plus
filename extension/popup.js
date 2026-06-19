const el = {
  status: document.getElementById("status"),
  message: document.getElementById("message"),
  propTitle: document.getElementById("propTitle"),
  propUrl: document.getElementById("propUrl"),
  propCreated: document.getElementById("propCreated"),
  propTags: document.getElementById("propTags"),
  subtitleSelect: document.getElementById("subtitleSelect"),
  preview: document.getElementById("preview"),
  aiSummary: document.getElementById("aiSummary"),
  aiPromptSelect: document.getElementById("aiPromptSelect"),
  summarizeBtn: document.getElementById("summarizeBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  copyBtn: document.getElementById("copyBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  sendBtn: document.getElementById("sendBtn"),
  readingViewBtn: document.getElementById("readingViewBtn"),
  settingsBtn: document.getElementById("settingsBtn")
};

let latestPayload = null;
let latestSettings = null;
let selectedSaveSource = "subtitle";
const EXPECTED_CONTENT_SCRIPT_VERSION = chrome.runtime.getManifest().version || "";
const DEFAULT_SETTINGS = {
  downloadFormat: "srt",
  aiEnabled: false,
  aiModel: "",
  aiPrompts: [],
  aiSelectedPromptId: ""
};

function formatLocalDate(value = Date.now()) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

init().catch((error) => {
  setStatus(`初始化失败：${error.message}`);
});

async function init() {
  bindEvents();
  latestSettings = await getSettingsFromRuntime();
  renderAiPromptOptions(latestSettings);
  setSelectedSaveSource("subtitle");
  await refreshFromTab();
}

function bindEvents() {
  el.refreshBtn.addEventListener("click", async () => {
    await refreshFromTab();
  });

  el.copyBtn.addEventListener("click", async () => {
    const payload = await ensurePayload();
    const current = getCurrentOutput(payload);
    if (!current.copyText) {
      setMessage("没有可复制内容，请先刷新。");
      return;
    }
    try {
      await navigator.clipboard.writeText(current.copyText);
      setMessage(`已复制${current.label}。`);
    } catch (error) {
      setMessage(`复制失败：${error?.message || "无法访问剪贴板"}`);
    }
  });

  el.downloadBtn.addEventListener("click", async () => {
    const payload = await ensurePayload();
    const settings = await getSettingsFromRuntime();
    const current = getCurrentOutput(payload, settings);
    if (payload?.contentType === "web" && current.source !== "ai") {
      if (!current.downloadText) {
        setMessage("没有可下载的网页内容。");
        return;
      }
      downloadTextFile(current.downloadText, `${sanitizeFileName(payload?.title || "web-clip")}.md`);
      setMessage("已下载网页 Markdown。");
      return;
    }
    if (current.source === "ai") {
      if (!current.downloadText) {
        setMessage("没有可下载的 AI 总结。");
        return;
      }
      downloadTextFile(current.downloadText, `${sanitizeFileName(payload?.title || "bilibili-ai-summary")}.ai-summary.md`);
      setMessage("已下载 AI 总结。");
      return;
    }
    const format = normalizeDownloadFormat(settings?.downloadFormat || payload?.downloadFormat);
    const content =
      format === "txt" ? payload?.txt || payload?.subtitlePreview || "" : payload?.srt || "";
    if (!content) {
      setMessage("没有可下载字幕。");
      return;
    }
    const safeTitle = sanitizeFileName(payload.title || "bilibili-subtitle");
    downloadTextFile(content, `${safeTitle}.${format}`);
    setMessage(`已下载 ${format.toUpperCase()}。`);
  });

  el.sendBtn.addEventListener("click", async () => {
    setStatus("正在发送到 Obsidian...");
    const saveSource = selectedSaveSource === "ai" && el.aiSummary.value.trim() ? "ai" : "subtitle";
    const resp = await sendToContent({
      type: "popup-send-obsidian",
      saveSource,
      aiSummary: saveSource === "ai" ? el.aiSummary.value.trim() : ""
    });
    if (!resp?.ok) {
      setMessage(`发送失败：${resp?.error || "未知错误"}`);
      render(resp?.payload || latestPayload);
      return;
    }
    render(resp?.payload || latestPayload);
    window.setTimeout(closeAfterSuccessfulSave, 120);
  });

  el.summarizeBtn.addEventListener("click", summarizeCurrentSubtitle);

  [el.preview, el.aiSummary].forEach((node) => {
    node.addEventListener("focus", () => setSelectedSaveSource(node === el.aiSummary ? "ai" : "subtitle"));
    node.addEventListener("pointerdown", () => setSelectedSaveSource(node === el.aiSummary ? "ai" : "subtitle"));
  });
  document.querySelectorAll(".preview-pane").forEach((pane) => {
    pane.addEventListener("mouseenter", () => setSelectedSaveSource(pane.dataset.source));
  });

  el.readingViewBtn?.addEventListener("click", async () => {
    const payload = await ensurePayload();
    const current = getCurrentOutput(payload);
    if (current.source === "ai") {
      if (!current.readText) {
        setMessage("没有可阅读的 AI 总结。");
        return;
      }
      await openAiReadingView(payload, current.readText);
      return;
    }

    const tab = await getActiveTab();
    if (!isSupportedSubtitlePage(tab?.url || "")) {
      setMessage("请先打开一个 B 站视频页。");
      return;
    }

    const prepResp = await sendToContent({ type: "popup-get-state" });
    if (!prepResp?.ok) {
      setMessage(prepResp?.error || "请刷新浏览器网页重试，或当前网页不支持");
      return;
    }

    setStatus("正在打开阅读视图...");
    const resp = await sendToRuntime({
      type: "open-reading-view-tab",
      url: tab.url,
      tabId: tab.id
    });
    if (!resp?.ok) {
      setMessage(`打开失败：${resp?.error || "未知错误"}`);
      return;
    }
    setMessage("已在当前页面打开阅读视图。");
    setStatus("阅读视图已打开。");
    window.setTimeout(() => window.close(), 80);
  });

  el.subtitleSelect.addEventListener("change", async (event) => {
    const option = event.target.options[event.target.selectedIndex];
    const url = String(option?.value || "");
    if (!url) {
      return;
    }
    setStatus("正在切换字幕...");
    const resp = await sendToContent({
      type: "popup-select-subtitle",
      url,
      lang: String(option.dataset.lang || "unknown"),
      subtitleId: String(option.dataset.id || "")
    });
    if (!resp?.ok) {
      setMessage(`切换失败：${resp?.error || "未知错误"}`);
    }
    el.aiSummary.value = "";
    setSelectedSaveSource("subtitle");
    render(resp?.payload || latestPayload);
  });

  el.settingsBtn.addEventListener("click", async () => {
    await sendToRuntime({ type: "open-options" });
  });
}

function getCurrentOutput(payload, settings = latestSettings) {
  const aiText = String(el.aiSummary.value || "").trim();
  if (selectedSaveSource === "ai" && aiText) {
    return {
      source: "ai",
      label: "AI 总结",
      copyText: aiText,
      downloadText: buildAiSummaryDocument(payload, aiText),
      readText: aiText
    };
  }
  if (payload?.contentType === "web") {
    return {
      source: "web",
      label: "网页 Markdown",
      copyText: payload?.markdown || payload?.txt || "",
      downloadText: payload?.markdown || payload?.txt || "",
      readText: payload?.txt || payload?.subtitlePreview || ""
    };
  }
  const format = normalizeDownloadFormat(settings?.downloadFormat || payload?.downloadFormat);
  return {
    source: "subtitle",
    label: "字幕 Markdown",
    copyText: payload?.markdown || "",
    downloadText: format === "txt" ? payload?.txt || payload?.subtitlePreview || "" : payload?.srt || "",
    readText: payload?.subtitlePreview || ""
  };
}

function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildAiSummaryDocument(payload, summary) {
  const title = String(payload?.title || "AI 总结").trim();
  const url = String(payload?.url || "").trim();
  return [`# ${title}`, url ? `\n${url}` : "", "\n## AI 总结\n", summary].join("\n").trim();
}

async function openAiReadingView(payload, summary) {
  const title = String(payload?.title || "AI 总结").trim();
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body{margin:0;background:#f6f7f9;color:#202124;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",Arial,sans-serif;line-height:1.75}
    main{max-width:860px;margin:0 auto;padding:32px 22px 56px}
    h1{font-size:24px;line-height:1.35;margin:0 0 16px}
    pre{white-space:pre-wrap;word-break:break-word;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px;font:inherit}
  </style>
</head>
<body><main><h1>${escapeHtml(title)}</h1><pre>${escapeHtml(summary)}</pre></main></body>
</html>`;
  const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  await chrome.tabs.create({ url });
  window.setTimeout(() => window.close(), 80);
}

async function refreshFromTab() {
  setStatus("正在抓取...");
  latestSettings = await getSettingsFromRuntime();
  renderAiPromptOptions(latestSettings);
  el.aiSummary.value = "";
  setSelectedSaveSource("subtitle");
  const resp = await sendToContent({ type: "popup-refresh" });
  if (!resp?.ok) {
    const errorText = resp?.error || "请在可读取的网页使用。";
    setStatus(`抓取失败：${errorText}`);
  }
  render(resp?.payload || latestPayload);
}

async function ensurePayload() {
  if (latestPayload) {
    return latestPayload;
  }
  const resp = await sendToContent({ type: "popup-get-state" });
  if (resp?.ok && resp.payload) {
    latestPayload = resp.payload;
  }
  return latestPayload;
}

function render(payload) {
  if (!payload) {
    return;
  }
  latestPayload = payload;

  setStatus(payload.status || "准备就绪");
  setMessage(payload.message || "");

  setText(el.propTitle, payload.title || "-");
  setText(el.propUrl, payload.url || "-");
  setText(el.propCreated, formatLocalDate());
  setText(el.propTags, payload.tags || "clippings");
  el.propTitle.title = payload.title || "";
  el.propUrl.title = payload.url || "";

  const options = payload.subtitleOptions || [];
  if (options.length === 0) {
    el.subtitleSelect.innerHTML = `<option value="">${payload.contentType === "web" ? "网页正文" : "暂无字幕"}</option>`;
    el.subtitleSelect.disabled = true;
  } else {
    el.subtitleSelect.innerHTML = options
      .map((item) => {
        const selected = item.selected ? "selected" : "";
        const aiTag = item.isAi ? " [AI]" : "";
        return `<option value="${escapeHtml(item.url)}" data-id="${escapeHtml(
          item.id || ""
        )}" data-lang="${escapeHtml(item.lang || "")}" ${selected}>${escapeHtml(
          `${item.lang || "unknown"}${aiTag}`
        )}</option>`;
      })
      .join("");
    el.subtitleSelect.disabled = false;
  }

  el.preview.value = payload.subtitlePreview || "";
  document.querySelector('label[for="subtitleSelect"]').textContent = payload.contentType === "web" ? "内容类型" : "字幕语言";
  document.querySelector('label[for="preview"]').textContent = payload.contentType === "web" ? "网页正文预览" : "字幕预览";
  el.readingViewBtn.disabled = payload.contentType === "web";
  updateAiControls();
}

async function summarizeCurrentSubtitle() {
  const payload = await ensurePayload();
  latestSettings = await getSettingsFromRuntime();
  renderAiPromptOptions(latestSettings);

  if (!latestSettings?.aiEnabled) {
    setMessage("请先在设置中启用 AI 总结。");
    return;
  }
  const text = payload?.txt || payload?.subtitlePreview || "";
  if (!text.trim()) {
    setMessage(payload?.contentType === "web" ? "没有可总结网页内容，请先刷新。" : "没有可总结字幕，请先刷新。");
    return;
  }

  setAiBusy(true);
  setStatus("AI 正在分析字幕...");
  setMessage("");
  try {
    const resp = await sendToRuntime({
      type: "summarize-text",
      text,
      title: payload?.title || "",
      promptId: el.aiPromptSelect.value || latestSettings.aiSelectedPromptId || "",
      model: latestSettings.aiModel || ""
    });
    if (!resp?.ok) {
      setMessage(`AI 总结失败：${resp?.error || "未知错误"}`);
      setStatus("AI 总结失败。");
      return;
    }
    el.aiSummary.value = resp.summary || "";
    setSelectedSaveSource("ai");
    setStatus("AI 总结完成。");
    setMessage("当前保存来源：AI 总结。");
  } catch (error) {
    setMessage(`AI 总结失败：${error.message || "未知错误"}`);
    setStatus("AI 总结失败。");
  } finally {
    setAiBusy(false);
  }
}

function renderAiPromptOptions(settings) {
  const prompts = Array.isArray(settings?.aiPrompts) ? settings.aiPrompts : [];
  if (!settings?.aiEnabled || prompts.length === 0) {
    el.aiPromptSelect.innerHTML = '<option value="">未启用 AI</option>';
    el.aiPromptSelect.disabled = true;
    updateAiControls();
    return;
  }
  const selectedId = settings.aiSelectedPromptId || prompts[0]?.id || "";
  el.aiPromptSelect.innerHTML = prompts
    .map((prompt) => {
      const selected = prompt.id === selectedId ? "selected" : "";
      return `<option value="${escapeHtml(prompt.id)}" ${selected}>${escapeHtml(prompt.name || "提示词")}</option>`;
    })
    .join("");
  el.aiPromptSelect.disabled = false;
  updateAiControls();
}

function updateAiControls() {
  const enabled = Boolean(latestSettings?.aiEnabled);
  el.summarizeBtn.disabled = !enabled;
  el.aiPromptSelect.disabled = !enabled || el.aiPromptSelect.options.length === 0;
}

function setAiBusy(isBusy) {
  el.summarizeBtn.disabled = isBusy || !latestSettings?.aiEnabled;
  el.aiPromptSelect.disabled = isBusy || !latestSettings?.aiEnabled;
  el.summarizeBtn.textContent = isBusy ? "分析中" : "总结";
}

function setSelectedSaveSource(source) {
  selectedSaveSource = source === "ai" ? "ai" : "subtitle";
  document.querySelectorAll(".preview-pane").forEach((pane) => {
    pane.dataset.selected = pane.dataset.source === selectedSaveSource ? "true" : "false";
  });
}

function setText(node, text) {
  node.textContent = String(text || "");
}

function setStatus(text) {
  el.status.textContent = String(text || "");
}

function setMessage(text) {
  el.message.textContent = String(text || "");
}

function sanitizeFileName(value) {
  return String(value || "subtitle")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function normalizeDownloadFormat(value) {
  return value === "txt" ? "txt" : "srt";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isEmbeddedPopup() {
  try {
    return new URL(location.href).searchParams.get("embedded") === "1";
  } catch {
    return false;
  }
}

async function closeAfterSuccessfulSave() {
  if (isEmbeddedPopup()) {
    await sendToContent({ type: "close-embedded-popup" });
    return;
  }
  window.close();
}

function getSourceTabIdFromUrl() {
  try {
    const tabId = Number(new URL(location.href).searchParams.get("tabId") || 0);
    return Number.isFinite(tabId) && tabId > 0 ? tabId : null;
  } catch {
    return null;
  }
}

async function getActiveTab() {
  const sourceTabId = getSourceTabIdFromUrl();
  if (sourceTabId) {
    const sourceTab = await chrome.tabs.get(sourceTabId).catch(() => null);
    if (sourceTab) {
      return sourceTab;
    }
  }

  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs?.[0] || null;
}

async function getActiveTabId() {
  const tab = await getActiveTab();
  return tab?.id || null;
}

async function sendToContent(message) {
  const tab = await getActiveTab();
  const tabId = tab?.id || null;
  if (!tabId) {
    throw new Error("找不到当前标签页");
  }

  try {
    return await sendMessageToTab(tabId, message);
  } catch (error) {
    if (shouldRetryAfterInjection(error) && isInjectableClipPage(tab?.url || "")) {
      try {
        await ensureContentScriptReady(tabId);
        await sleep(80);
        return await sendMessageToTab(tabId, message);
      } catch (retryError) {
        error = retryError;
      }
    }

    const normalizedError = normalizeContentErrorMessage(error);
    setStatus("当前网页暂不支持插件注入。");
    setMessage(normalizedError);
    return { ok: false, error: normalizedError, payload: latestPayload };
  }
}

function normalizeContentErrorMessage(error) {
  const message = String(error?.message || "").trim();
  if (message.includes("Could not establish connection. Receiving end does not exist.")) {
    return "请刷新浏览器网页重试，或当前网页不支持";
  }
  return message || "未知错误";
}

function shouldRetryAfterInjection(error) {
  const message = String(error?.message || "");
  return message.includes("Could not establish connection. Receiving end does not exist.");
}

function isSupportedSubtitlePage(url) {
  try {
    const parsed = new URL(String(url || ""));
    if (parsed.hostname !== "www.bilibili.com") {
      return false;
    }
    return parsed.pathname === "/list/watchlater" ||
      parsed.pathname === "/list/watchlater/" ||
      parsed.pathname.startsWith("/video/");
  } catch {
    return false;
  }
}

function isInjectableClipPage(url) {
  try {
    const parsed = new URL(String(url || ""));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function ensureContentScriptReady(tabId) {
  if (!chrome.scripting) {
    throw new Error("请刷新浏览器网页重试，或当前网页不支持");
  }

  const loadedVersion = await probeContentScriptVersion(tabId);
  if (loadedVersion === EXPECTED_CONTENT_SCRIPT_VERSION) {
    return;
  }

  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["content.css"]
  });

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("Identifier 'DEFAULT_SETTINGS' has already been declared")) {
      throw error;
    }
  }

  const reinjectedVersion = await probeContentScriptVersion(tabId);
  if (reinjectedVersion !== EXPECTED_CONTENT_SCRIPT_VERSION) {
    throw new Error("扩展刚更新，请刷新当前页面后重试。");
  }
}

async function probeContentScriptVersion(tabId) {
  try {
    const probe = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => globalThis.__BOC_CONTENT_SCRIPT_LOADED__ || ""
    });
    return String(probe?.[0]?.result || "");
  } catch {
    return "";
  }
}

async function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (resp) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(resp);
    });
  });
}

async function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function sendToRuntime(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (resp) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(resp);
    });
  });
}

async function getSettingsFromRuntime() {
  try {
    const resp = await sendToRuntime({ type: "get-settings" });
    if (!resp?.ok) {
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...(resp.settings || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
