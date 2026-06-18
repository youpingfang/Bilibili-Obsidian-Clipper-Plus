const DEFAULT_SETTINGS = {
  noteFolder: "Clippings/Bilibili",
  obsidianApiBaseUrl: "http://127.0.0.1:27123",
  obsidianApiKey: "",
  tags: "clippings,bilibili",
  downloadFormat: "srt",
  includeDateInFilename: true,
  includeTimestampInBody: true,
  enableDebugLogs: false,
  aiEnabled: false,
  aiBaseUrl: "https://api.deepseek.com",
  aiApiKey: "",
  aiModel: "",
  aiPrompts: [
    {
      id: "default-summary",
      name: "通用总结",
      content:
        "请基于下面的哔哩哔哩（Bilibili）视频字幕进行结构化总结，不要按 YouTube 视频语境处理。保留关键观点、步骤、结论和可执行建议。输出 Markdown，语言与字幕保持一致。"
    }
  ],
  aiSelectedPromptId: "default-summary",
  frontmatterFields: [
    "title",
    "url",
    "bvid",
    "cid",
    "author",
    "upload_date",
    "subtitle_lang",
    "created",
    "tags"
  ],
  fixedFrontmatterProperties: []
};

const SYSTEM_FRONTMATTER_FIELDS = new Set(DEFAULT_SETTINGS.frontmatterFields.map((field) => String(field).toLowerCase()));
const CUSTOM_PROPERTY_KEY_PATTERN = /^[\p{L}\p{N}_\-\s]+$/u;
const FIXED_PROPERTY_TYPES = new Set(["text", "number", "checkbox", "list"]);
const LEGACY_DEFAULT_AI_PROMPT =
  "请基于下面的视频字幕进行结构化总结，保留关键观点、步骤、结论和可执行建议。输出 Markdown，语言与字幕保持一致。";

const elements = {
  noteFolder: document.getElementById("noteFolder"),
  obsidianApiBaseUrl: document.getElementById("obsidianApiBaseUrl"),
  obsidianApiKey: document.getElementById("obsidianApiKey"),
  tags: document.getElementById("tags"),
  downloadFormat: document.getElementById("downloadFormat"),
  includeDateInFilename: document.getElementById("includeDateInFilename"),
  includeTimestampInBody: document.getElementById("includeTimestampInBody"),
  enableDebugLogs: document.getElementById("enableDebugLogs"),
  aiEnabled: document.getElementById("aiEnabled"),
  aiBaseUrl: document.getElementById("aiBaseUrl"),
  aiApiKey: document.getElementById("aiApiKey"),
  aiModel: document.getElementById("aiModel"),
  fetchAiModelsBtn: document.getElementById("fetchAiModelsBtn"),
  aiPromptsList: document.getElementById("aiPromptsList"),
  aiPromptsEmpty: document.getElementById("aiPromptsEmpty"),
  addAiPromptBtn: document.getElementById("addAiPromptBtn"),
  frontmatterFields: document.querySelectorAll('input[name="frontmatterField"]'),
  fixedPropertiesList: document.getElementById("fixedPropertiesList"),
  fixedPropertiesEmpty: document.getElementById("fixedPropertiesEmpty"),
  addFixedPropertyBtn: document.getElementById("addFixedPropertyBtn"),
  saveBtn: document.getElementById("saveBtn"),
  testConnectionBtn: document.getElementById("testConnectionBtn"),
  status: document.getElementById("status")
};

init();

function init() {
  loadSettings();
  elements.saveBtn.addEventListener("click", saveSettings);
  elements.testConnectionBtn.addEventListener("click", testConnection);
  elements.addFixedPropertyBtn.addEventListener("click", () => addFixedPropertyRow());
  elements.fetchAiModelsBtn.addEventListener("click", fetchAiModels);
  elements.addAiPromptBtn.addEventListener("click", () => addAiPromptRow());
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(".fixed-property-type-picker")) {
      closeAllFixedPropertyMenus();
    }
  });
  [
    elements.noteFolder,
    elements.obsidianApiBaseUrl,
    elements.obsidianApiKey,
    elements.tags,
    elements.aiBaseUrl,
    elements.aiApiKey
  ].forEach((input) => {
    input?.addEventListener("input", () => input.classList.remove("input-error"));
  });
}

async function loadSettings() {
  const settings = await getSettings();
  elements.noteFolder.value = settings.noteFolder || "";
  elements.obsidianApiBaseUrl.value = settings.obsidianApiBaseUrl || "";
  elements.obsidianApiKey.value = settings.obsidianApiKey || "";
  elements.tags.value = settings.tags || "";
  elements.downloadFormat.value = normalizeDownloadFormat(settings.downloadFormat);
  elements.includeDateInFilename.checked = settings.includeDateInFilename !== false;
  elements.includeTimestampInBody.checked = Boolean(settings.includeTimestampInBody);
  elements.enableDebugLogs.checked = Boolean(settings.enableDebugLogs);
  elements.aiEnabled.checked = Boolean(settings.aiEnabled);
  elements.aiBaseUrl.value = settings.aiBaseUrl || "";
  elements.aiApiKey.value = settings.aiApiKey || "";
  renderAiModelOptions(settings.aiModel ? [settings.aiModel] : [], settings.aiModel || "");
  renderAiPromptRows(settings.aiPrompts, settings.aiSelectedPromptId);
  const selectedFields = new Set(settings.frontmatterFields || DEFAULT_SETTINGS.frontmatterFields);
  elements.frontmatterFields.forEach((checkbox) => {
    checkbox.checked = selectedFields.has(checkbox.value);
  });
  renderFixedPropertyRows(settings.fixedFrontmatterProperties);
}

async function saveSettings() {
  clearInputErrors();
  const payload = collectFormPayload();
  const validation = validateSettings(payload, { requireApiKey: false });
  if (!validation.ok) {
    applyValidationError(validation);
    return;
  }

  setBusy(true);
  try {
    const resp = await sendRuntimeMessage({ type: "save-settings", settings: payload });
    if (!resp?.ok) {
      setStatus(resp?.error || "保存失败", true);
      return;
    }
    renderFixedPropertyRows(payload.fixedFrontmatterProperties);
    setStatus(payload.obsidianApiKey ? "保存成功" : "保存成功（未填写 Obsidian API Key，暂不可写入 Obsidian）");
  } catch (error) {
    setStatus(error.message || "保存失败", true);
  } finally {
    setBusy(false);
  }
}

async function getSettings() {
  try {
    const resp = await sendRuntimeMessage({ type: "get-settings" });
    if (!resp?.ok) {
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...(resp.settings || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function setStatus(text, isError = false) {
  elements.status.textContent = text;
  elements.status.dataset.error = isError ? "true" : "false";
}

function normalizeDownloadFormat(value) {
  return value === "txt" ? "txt" : "srt";
}

function collectFormPayload() {
  const selectedFields = Array.from(elements.frontmatterFields)
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);

  const normalizedBaseUrl = normalizeBaseUrl(elements.obsidianApiBaseUrl.value);
  const normalizedApiKey = normalizeApiKey(elements.obsidianApiKey.value);
  const normalizedAiBaseUrl = normalizeBaseUrl(elements.aiBaseUrl.value);
  const normalizedAiApiKey = normalizeApiKey(elements.aiApiKey.value);
  elements.obsidianApiBaseUrl.value = normalizedBaseUrl;
  elements.obsidianApiKey.value = normalizedApiKey;
  elements.aiBaseUrl.value = normalizedAiBaseUrl;
  elements.aiApiKey.value = normalizedAiApiKey;
  const aiPrompts = normalizeAiPrompts(collectAiPromptRows());
  const selectedPrompt = aiPrompts.find((item) => item.selected) || aiPrompts[0] || null;

  return {
    noteFolder: elements.noteFolder.value.trim(),
    obsidianApiBaseUrl: normalizedBaseUrl,
    obsidianApiKey: normalizedApiKey,
    tags: elements.tags.value.trim(),
    downloadFormat: normalizeDownloadFormat(elements.downloadFormat.value),
    includeDateInFilename: elements.includeDateInFilename.checked,
    includeTimestampInBody: elements.includeTimestampInBody.checked,
    enableDebugLogs: elements.enableDebugLogs.checked,
    aiEnabled: elements.aiEnabled.checked,
    aiBaseUrl: normalizedAiBaseUrl,
    aiApiKey: normalizedAiApiKey,
    aiModel: String(elements.aiModel.value || "").trim(),
    aiPrompts: aiPrompts.map(({ selected, ...item }) => item),
    aiSelectedPromptId: selectedPrompt?.id || "",
    frontmatterFields: selectedFields,
    fixedFrontmatterProperties: normalizeFixedFrontmatterProperties(collectFixedPropertyRows())
  };
}

function validateSettings(payload, { requireApiKey }) {
  if (!payload.noteFolder) {
    return { ok: false, field: elements.noteFolder, message: "请填写笔记目录（例如：Clippings/Bilibili）" };
  }
  if (/^[\/\\]|[\/\\]$/.test(payload.noteFolder)) {
    return { ok: false, field: elements.noteFolder, message: "笔记目录无需以 / 开头或结尾" };
  }
  if (/[\\:*?"<>|\u0000-\u001f]/.test(payload.noteFolder)) {
    return { ok: false, field: elements.noteFolder, message: "笔记目录包含非法字符，请修改后再试" };
  }

  if (!payload.obsidianApiBaseUrl) {
    return { ok: false, field: elements.obsidianApiBaseUrl, message: "请填写 Local REST API 地址" };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(payload.obsidianApiBaseUrl);
  } catch {
    return { ok: false, field: elements.obsidianApiBaseUrl, message: "Local REST API 地址格式不正确" };
  }

  const protocol = parsedUrl.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return { ok: false, field: elements.obsidianApiBaseUrl, message: "Local REST API 地址仅支持 http 或 https" };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const isLocal = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
  if (!isLocal) {
    return {
      ok: false,
      field: elements.obsidianApiBaseUrl,
      message: "请使用本机地址（127.0.0.1 或 localhost），不要填写公网/局域网地址"
    };
  }

  if ((parsedUrl.pathname && parsedUrl.pathname !== "/") || parsedUrl.search || parsedUrl.hash) {
    return { ok: false, field: elements.obsidianApiBaseUrl, message: "地址请只填写到端口，例如 http://127.0.0.1:27123" };
  }

  if (requireApiKey && !payload.obsidianApiKey) {
    return { ok: false, field: elements.obsidianApiKey, message: "测试连接前请填写 Local REST API Key" };
  }

  if (/[\r\n]/.test(payload.tags)) {
    return { ok: false, field: elements.tags, message: "默认标签请使用逗号分隔，不要换行" };
  }

  if (payload.aiEnabled) {
    if (!payload.aiBaseUrl) {
      return { ok: false, field: elements.aiBaseUrl, message: "启用 AI 总结前请填写 AI API 地址" };
    }
    try {
      const aiUrl = new URL(payload.aiBaseUrl);
      if (aiUrl.protocol !== "http:" && aiUrl.protocol !== "https:") {
        return { ok: false, field: elements.aiBaseUrl, message: "AI API 地址仅支持 http 或 https" };
      }
    } catch {
      return { ok: false, field: elements.aiBaseUrl, message: "AI API 地址格式不正确" };
    }
    if (!payload.aiApiKey) {
      return { ok: false, field: elements.aiApiKey, message: "启用 AI 总结前请填写 AI API Key" };
    }
    if (!payload.aiModel) {
      return { ok: false, field: elements.aiModel, message: "启用 AI 总结前请选择或填写模型" };
    }
    if (payload.aiPrompts.length === 0) {
      return { ok: false, message: "请至少添加一个 AI 提示词" };
    }
  }

  const promptValidation = validateAiPrompts(collectAiPromptRows({ includeRow: true }));
  if (!promptValidation.ok) {
    return promptValidation;
  }

  const fixedPropertyValidation = validateFixedFrontmatterProperties(collectFixedPropertyRows({ includeRow: true }));
  if (!fixedPropertyValidation.ok) {
    return fixedPropertyValidation;
  }

  return { ok: true };
}

function applyValidationError(validation) {
  clearInputErrors();
  if (validation?.field) {
    validation.field.classList.add("input-error");
    validation.field.focus();
  }
  if (validation?.row) {
    const keyInput = validation.row.querySelector(".fixed-property-key, .ai-prompt-name");
    const valueInput = validation.row.querySelector(".fixed-property-value, .ai-prompt-content");
    if (keyInput && !String(keyInput.value || "").trim()) {
      keyInput.classList.add("input-error");
      keyInput.focus();
    } else if (valueInput && !String(valueInput.value || "").trim()) {
      valueInput.classList.add("input-error");
      valueInput.focus();
    } else if (keyInput) {
      keyInput.classList.add("input-error");
      keyInput.focus();
    }

    const errorNode = validation.row.querySelector(".fixed-property-error");
    if (errorNode) {
      errorNode.hidden = false;
      errorNode.textContent = validation.message || "固定属性校验失败";
    }
    const promptErrorNode = validation.row.querySelector(".ai-prompt-error");
    if (promptErrorNode) {
      promptErrorNode.hidden = false;
      promptErrorNode.textContent = validation.message || "提示词校验失败";
    }
  }
  setStatus(validation?.message || "设置校验失败", true);
}

function clearInputErrors() {
  [
    elements.noteFolder,
    elements.obsidianApiBaseUrl,
    elements.obsidianApiKey,
    elements.tags,
    elements.aiBaseUrl,
    elements.aiApiKey,
    elements.aiModel
  ].forEach((input) => {
    input?.classList.remove("input-error");
  });
  clearAiPromptErrors();
  clearFixedPropertyErrors();
}

function renderAiModelOptions(models, selectedModel = "") {
  const uniqueModels = Array.from(
    new Set([selectedModel, ...(Array.isArray(models) ? models : [])].map((item) => String(item || "").trim()).filter(Boolean))
  );
  if (uniqueModels.length === 0) {
    elements.aiModel.innerHTML = '<option value="">请先获取模型</option>';
    return;
  }
  elements.aiModel.innerHTML = uniqueModels
    .map((model) => {
      const selected = model === selectedModel ? "selected" : "";
      return `<option value="${escapeAttribute(model)}" ${selected}>${escapeHtml(model)}</option>`;
    })
    .join("");
}

async function fetchAiModels() {
  const baseUrl = normalizeBaseUrl(elements.aiBaseUrl.value);
  const apiKey = normalizeApiKey(elements.aiApiKey.value);
  elements.aiBaseUrl.value = baseUrl;
  elements.aiApiKey.value = apiKey;
  if (!baseUrl) {
    applyValidationError({ field: elements.aiBaseUrl, message: "请先填写 AI API 地址" });
    return;
  }
  if (!apiKey) {
    applyValidationError({ field: elements.aiApiKey, message: "请先填写 AI API Key" });
    return;
  }

  setBusy(true);
  setStatus("正在获取模型...");
  try {
    const resp = await sendRuntimeMessage({ type: "fetch-ai-models", baseUrl, apiKey });
    if (!resp?.ok) {
      setStatus(`获取模型失败：${resp?.error || "未知错误"}`, true);
      return;
    }
    renderAiModelOptions(resp.models || [], elements.aiModel.value || resp.models?.[0] || "");
    setStatus(`已获取 ${Number(resp.models?.length || 0)} 个模型`);
  } catch (error) {
    setStatus(`获取模型失败：${error.message || "未知错误"}`, true);
  } finally {
    setBusy(false);
  }
}

function renderAiPromptRows(items, selectedId = "") {
  elements.aiPromptsList.innerHTML = "";
  const rows = normalizeAiPrompts(items).map((item) => ({
    ...item,
    selected: String(item.id || "") === String(selectedId || "")
  }));
  if (rows.length > 0 && !rows.some((item) => item.selected)) {
    rows[0].selected = true;
  }
  rows.forEach((item) => addAiPromptRow(item));
  updateAiPromptEmptyState();
}

function addAiPromptRow(item = {}) {
  const promptId = String(item.id || createPromptId()).trim();
  const row = document.createElement("div");
  row.className = "ai-prompt-row";
  row.dataset.promptId = promptId;
  row.innerHTML = `
    <div class="ai-prompt-toolbar">
      <label class="mini-checkbox">
        <input class="ai-prompt-selected" type="radio" name="aiPromptSelected" ${item.selected ? "checked" : ""} />
        默认
      </label>
      <input class="ai-prompt-name" type="text" placeholder="提示词名称" value="${escapeAttribute(item.name)}" />
      <button class="fixed-property-remove ai-prompt-remove" type="button" aria-label="删除提示词" title="删除提示词">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M4 7h16"></path>
          <path d="M9 3h6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"></path>
        </svg>
      </button>
    </div>
    <textarea class="ai-prompt-content" rows="4" placeholder="输入总结提示词">${escapeHtml(item.content)}</textarea>
    <p class="ai-prompt-error" hidden></p>
  `;

  row.querySelector(".ai-prompt-remove")?.addEventListener("click", () => {
    row.remove();
    ensureOneAiPromptSelected();
    updateAiPromptEmptyState();
  });
  row.querySelectorAll("input, textarea").forEach((input) => {
    input.addEventListener("input", () => {
      input.classList.remove("input-error");
      clearAiPromptErrorState(row);
    });
  });

  elements.aiPromptsList.appendChild(row);
  ensureOneAiPromptSelected();
  updateAiPromptEmptyState();
}

function collectAiPromptRows({ includeRow = false } = {}) {
  return Array.from(elements.aiPromptsList.querySelectorAll(".ai-prompt-row")).map((row) => {
    const item = {
      id: String(row.dataset.promptId || "").trim() || createPromptId(),
      name: String(row.querySelector(".ai-prompt-name")?.value || "").trim(),
      content: String(row.querySelector(".ai-prompt-content")?.value || "").trim(),
      selected: Boolean(row.querySelector(".ai-prompt-selected")?.checked)
    };
    if (includeRow) {
      item.row = row;
    }
    return item;
  });
}

function validateAiPrompts(items) {
  const rows = Array.isArray(items) ? items : [];
  for (const item of rows) {
    if (!item.name && !item.content) {
      continue;
    }
    if (!item.name) {
      return { ok: false, row: item.row, message: "请填写提示词名称" };
    }
    if (!item.content) {
      return { ok: false, row: item.row, message: "请填写提示词内容" };
    }
  }
  return { ok: true };
}

function normalizeAiPrompts(items) {
  const rows = Array.isArray(items) ? items : [];
  return rows
    .map((item) => ({
      id: String(item?.id || "").trim() || createPromptId(),
      name: String(item?.name || "").trim(),
      content: normalizeAiPromptContent(item),
      selected: Boolean(item?.selected)
    }))
    .filter((item) => item.name && item.content);
}

function normalizeAiPromptContent(item) {
  const content = String(item?.content || "").trim();
  if (String(item?.id || "").trim() === "default-summary" && content === LEGACY_DEFAULT_AI_PROMPT) {
    return DEFAULT_SETTINGS.aiPrompts[0].content;
  }
  return content;
}

function createPromptId() {
  return `prompt-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function updateAiPromptEmptyState() {
  elements.aiPromptsEmpty.hidden = elements.aiPromptsList.children.length > 0;
}

function ensureOneAiPromptSelected() {
  const radios = Array.from(elements.aiPromptsList.querySelectorAll(".ai-prompt-selected"));
  if (radios.length > 0 && !radios.some((radio) => radio.checked)) {
    radios[0].checked = true;
  }
}

function clearAiPromptErrors() {
  elements.aiPromptsList.querySelectorAll(".ai-prompt-name, .ai-prompt-content").forEach((input) => {
    input.classList.remove("input-error");
  });
  elements.aiPromptsList.querySelectorAll(".ai-prompt-error").forEach((node) => {
    node.hidden = true;
    node.textContent = "";
  });
}

function clearAiPromptErrorState(row) {
  row.querySelectorAll(".ai-prompt-name, .ai-prompt-content").forEach((input) => {
    input.classList.remove("input-error");
  });
  const errorNode = row.querySelector(".ai-prompt-error");
  if (errorNode) {
    errorNode.hidden = true;
    errorNode.textContent = "";
  }
}

function renderFixedPropertyRows(items) {
  elements.fixedPropertiesList.innerHTML = "";
  const rows = Array.isArray(items) ? items : [];
  rows.forEach((item) => addFixedPropertyRow(item));
  updateFixedPropertyEmptyState();
}

function addFixedPropertyRow(item = {}) {
  const type = normalizeFixedPropertyType(item.type);
  const row = document.createElement("div");
  row.className = "fixed-property-row";
  row.innerHTML = `
    <div class="fixed-property-fields">
      <div class="fixed-property-field fixed-property-field-type">${buildFixedPropertyTypePicker(type)}</div>
      <div class="fixed-property-field fixed-property-field-key">
        <input class="fixed-property-key" type="text" placeholder="属性名" value="${escapeAttribute(item.key)}" />
      </div>
      <div class="fixed-property-field fixed-property-field-value">
        <div class="fixed-property-value-slot">${buildFixedPropertyValueControl(type, item.value)}</div>
      </div>
      <div class="fixed-property-field fixed-property-field-remove">
        <button class="fixed-property-remove" type="button" aria-label="删除属性" title="删除属性">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M4 7h16"></path>
            <path d="M9 3h6"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
            <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"></path>
          </svg>
        </button>
      </div>
    </div>
    <p class="fixed-property-error" hidden></p>
  `;

  row.querySelector(".fixed-property-remove")?.addEventListener("click", () => {
    row.remove();
    updateFixedPropertyEmptyState();
  });

  const typeButton = row.querySelector(".fixed-property-type-button");
  const typePicker = row.querySelector(".fixed-property-type-picker");
  const typeMenu = row.querySelector(".fixed-property-type-menu");

  typeButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = typePicker?.dataset.open === "true";
    closeAllFixedPropertyMenus();
    if (typePicker && typeMenu && !isOpen) {
      typePicker.dataset.open = "true";
      typeButton.setAttribute("aria-expanded", "true");
      typeMenu.hidden = false;
    }
  });

  row.querySelectorAll(".fixed-property-type-option").forEach((option) => {
    option.addEventListener("click", () => {
      const nextType = normalizeFixedPropertyType(option.getAttribute("data-type"));
      const valueSlot = row.querySelector(".fixed-property-value-slot");
      if (typePicker) {
        typePicker.dataset.type = nextType;
        typePicker.dataset.open = "false";
      }
      if (typeButton) {
        typeButton.setAttribute("aria-expanded", "false");
        const labelNode = typeButton.querySelector(".fixed-property-type-label");
        if (labelNode) {
          labelNode.textContent = getFixedPropertyTypeLabel(nextType);
        }
      }
      if (typeMenu) {
        typeMenu.hidden = true;
      }
      const currentValue = readFixedPropertyValue(row);
      if (valueSlot) {
        valueSlot.innerHTML = buildFixedPropertyValueControl(nextType, currentValue);
        bindFixedPropertyValueEvents(row);
      }
      clearFixedPropertyErrorState(row);
    });
  });

  row.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      input.classList.remove("input-error");
      clearFixedPropertyErrorState(row);
    });
  });
  bindFixedPropertyValueEvents(row);

  elements.fixedPropertiesList.appendChild(row);
  updateFixedPropertyEmptyState();
}

function updateFixedPropertyEmptyState() {
  const hasRows = elements.fixedPropertiesList.children.length > 0;
  elements.fixedPropertiesEmpty.hidden = hasRows;
}

function collectFixedPropertyRows({ includeRow = false } = {}) {
  return Array.from(elements.fixedPropertiesList.querySelectorAll(".fixed-property-row")).map((row) => {
    const type = normalizeFixedPropertyType(row.querySelector(".fixed-property-type-picker")?.getAttribute("data-type"));
    const item = {
      key: String(row.querySelector(".fixed-property-key")?.value || "").trim(),
      type,
      value: readFixedPropertyValue(row, type)
    };
    if (includeRow) {
      item.row = row;
    }
    return item;
  });
}

function validateFixedFrontmatterProperties(items) {
  const seenKeys = new Set();
  const rows = Array.isArray(items) ? items : [];
  for (const item of rows) {
    const key = String(item?.key || "").trim();
    const type = normalizeFixedPropertyType(item?.type);
    const value = item?.value;
    const lowerKey = key.toLowerCase();
    const valueText = typeof value === "string" ? value.trim() : "";

    if (!key && isFixedPropertyRowEffectivelyEmpty(type, value)) {
      continue;
    }
    if (!key) {
      return { ok: false, row: item.row, message: "请填写固定属性的属性名" };
    }
    if (!CUSTOM_PROPERTY_KEY_PATTERN.test(key)) {
      return { ok: false, row: item.row, message: "属性名仅支持中文、英文、数字、空格、下划线和短横线" };
    }
    if (type === "number") {
      if (!valueText) {
        return { ok: false, row: item.row, message: "请填写数字类型的属性值" };
      }
      if (!Number.isFinite(Number(valueText))) {
        return { ok: false, row: item.row, message: "数字类型的属性值必须是有效数字" };
      }
    } else if (type === "checkbox") {
      if (!valueText) {
        return { ok: false, row: item.row, message: "请填写复选框类型的属性值" };
      }
      const normalizedCheckboxValue = valueText.toLowerCase();
      if (normalizedCheckboxValue !== "true" && normalizedCheckboxValue !== "false") {
        return { ok: false, row: item.row, message: "复选框类型的属性值只能填写 true 或 false" };
      }
    } else if (!valueText) {
      return { ok: false, row: item.row, message: "请填写固定属性的属性值" };
    }
    if (SYSTEM_FRONTMATTER_FIELDS.has(lowerKey)) {
      return { ok: false, row: item.row, message: "该属性名与系统字段重复，请换一个名称" };
    }
    if (seenKeys.has(lowerKey)) {
      return { ok: false, row: item.row, message: "固定属性名不能重复" };
    }
    seenKeys.add(lowerKey);
  }

  return { ok: true };
}

function clearFixedPropertyErrors() {
  elements.fixedPropertiesList.querySelectorAll(".fixed-property-key, .fixed-property-value").forEach((input) => {
    input.classList.remove("input-error");
  });
  elements.fixedPropertiesList.querySelectorAll(".fixed-property-type-button").forEach((input) => {
    input.classList.remove("input-error");
  });
  elements.fixedPropertiesList.querySelectorAll(".fixed-property-error").forEach((node) => {
    node.hidden = true;
    node.textContent = "";
  });
}

function normalizeFixedFrontmatterProperties(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      key: String(item?.key || "").trim(),
      type: normalizeFixedPropertyType(item?.type),
      value: normalizeFixedPropertyValue(item?.type, item?.value)
    }))
    .filter((item) => item.key && !isFixedPropertyRowEffectivelyEmpty(item.type, item.value));
}

function normalizeFixedPropertyType(value) {
  const type = String(value || "").trim().toLowerCase();
  return FIXED_PROPERTY_TYPES.has(type) ? type : "text";
}

function normalizeFixedPropertyValue(type, value) {
  const normalizedType = normalizeFixedPropertyType(type);
  if (normalizedType === "checkbox") {
    return String(value || "").trim().toLowerCase();
  }
  return String(value || "").trim();
}

function isFixedPropertyRowEffectivelyEmpty(type, value) {
  return !String(value || "").trim();
}

function readFixedPropertyValue(row, _type = normalizeFixedPropertyType(row.querySelector(".fixed-property-type")?.value)) {
  return String(row.querySelector(".fixed-property-value")?.value || "").trim();
}

function buildFixedPropertyValueControl(type, value) {
  const normalizedType = normalizeFixedPropertyType(type);
  const placeholder =
    normalizedType === "number"
      ? "数字值"
      : normalizedType === "checkbox"
        ? "true / false"
        : normalizedType === "list"
          ? "多个值，用逗号分隔"
          : "属性值";
  return `<input class="fixed-property-value" type="text" placeholder="${placeholder}" value="${escapeAttribute(value)}" />`;
}

function buildFixedPropertyTypePicker(type) {
  const normalizedType = normalizeFixedPropertyType(type);
  return `
    <div class="fixed-property-type-picker" data-type="${normalizedType}" data-open="false">
      <button class="fixed-property-type-button" type="button" aria-label="属性类型" aria-haspopup="true" aria-expanded="false">
        <span class="fixed-property-type-label">${getFixedPropertyTypeLabel(normalizedType)}</span>
        <svg viewBox="0 0 12 12" focusable="false" aria-hidden="true">
          <path d="M2.25 4.5 6 8.25 9.75 4.5"></path>
        </svg>
      </button>
      <div class="fixed-property-type-menu" hidden>
        <button class="fixed-property-type-option" type="button" data-type="text">文本</button>
        <button class="fixed-property-type-option" type="button" data-type="number">数字</button>
        <button class="fixed-property-type-option" type="button" data-type="checkbox">复选框</button>
        <button class="fixed-property-type-option" type="button" data-type="list">列表</button>
      </div>
    </div>
  `;
}

function getFixedPropertyTypeLabel(type) {
  const normalizedType = normalizeFixedPropertyType(type);
  if (normalizedType === "number") {
    return "数字";
  }
  if (normalizedType === "checkbox") {
    return "复选框";
  }
  if (normalizedType === "list") {
    return "列表";
  }
  return "文本";
}

function bindFixedPropertyValueEvents(row) {
  row.querySelectorAll(".fixed-property-value").forEach((input) => {
    input.addEventListener("input", () => clearFixedPropertyErrorState(row));
    input.addEventListener("change", () => clearFixedPropertyErrorState(row));
  });
}

function clearFixedPropertyErrorState(row) {
  row.querySelectorAll(".fixed-property-key, .fixed-property-value, .fixed-property-type-button").forEach((input) => {
    input.classList.remove("input-error");
  });
  const errorNode = row.querySelector(".fixed-property-error");
  if (errorNode) {
    errorNode.hidden = true;
    errorNode.textContent = "";
  }
}

function closeAllFixedPropertyMenus() {
  elements.fixedPropertiesList.querySelectorAll(".fixed-property-type-picker").forEach((picker) => {
    picker.setAttribute("data-open", "false");
    const button = picker.querySelector(".fixed-property-type-button");
    const menu = picker.querySelector(".fixed-property-type-menu");
    if (button) {
      button.setAttribute("aria-expanded", "false");
    }
    if (menu) {
      menu.hidden = true;
    }
  });
}

function escapeAttribute(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/g, "");
}

function normalizeApiKey(value) {
  return String(value || "").trim().replace(/^Bearer\s+/i, "").trim();
}

async function testConnection() {
  clearInputErrors();
  const payload = collectFormPayload();
  const validation = validateSettings(payload, { requireApiKey: true });
  if (!validation.ok) {
    applyValidationError(validation);
    return;
  }

  setBusy(true);
  setStatus("正在测试连接...");
  try {
    const resp = await sendRuntimeMessage({
      type: "test-obsidian-connection",
      baseUrl: payload.obsidianApiBaseUrl,
      apiKey: payload.obsidianApiKey
    });

    if (!resp?.ok) {
      setStatus(`连接失败：${resp?.error || "未知错误"}`, true);
      return;
    }

    const service = resp?.service ? `（${resp.service}）` : "";
    setStatus(`连接成功 ${service}`);
  } catch (error) {
    setStatus(`连接失败：${error.message || "未知错误"}`, true);
  } finally {
    setBusy(false);
  }
}

function setBusy(isBusy) {
  elements.saveBtn.disabled = isBusy;
  elements.testConnectionBtn.disabled = isBusy;
  elements.fetchAiModelsBtn.disabled = isBusy;
  elements.saveBtn.textContent = isBusy ? "处理中..." : "保存设置";
  elements.testConnectionBtn.textContent = isBusy ? "处理中..." : "测试连接";
  elements.fetchAiModelsBtn.textContent = isBusy ? "处理中..." : "获取模型";
}

function sendRuntimeMessage(message) {
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
