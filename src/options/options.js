(function startPatinaOptions() {
  "use strict";

  const api = globalThis.browser ?? globalThis.chrome;
  const localStore = api?.storage?.local ?? {
    async get() { return {}; },
    async set() {}
  };
  const { DAY, DEFAULT_SETTINGS, expandCustomText, sanitizeSettings } = globalThis.PatinaTime;
  const form = document.querySelector("#settings");
  const preview = document.querySelector("#preview");
  const customRow = document.querySelector("#custom-row");
  const customText = document.querySelector("#custom-text");
  const emojiHelp = document.querySelector("#emoji-help");
  const thresholdValue = document.querySelector("#threshold-value");
  const thresholdError = document.querySelector("#threshold-error");
  const customError = document.querySelector("#custom-error");
  const saveState = document.querySelector("#save-state");
  let saveTimer;

  function showEmojiShortcut(os) {
    emojiHelp.hidden = false;
    emojiHelp.replaceChildren(document.createTextNode("Emoji picker: "));
    if (os === "win") {
      const key = document.createElement("kbd");
      key.textContent = "Windows + .";
      emojiHelp.append(key);
    } else if (os === "mac") {
      const key = document.createElement("kbd");
      key.textContent = "Control + Command + Space";
      emojiHelp.append(key);
    } else {
      emojiHelp.append(document.createTextNode("use your system picker, or paste an emoji here."));
    }
  }

  async function loadPlatformHint() {
    try {
      const platform = await api?.runtime?.getPlatformInfo?.();
      if (platform?.os) {
        showEmojiShortcut(platform.os);
        return;
      }
    } catch (_) {
      // The localhost design preview has no extension runtime.
    }
    const localPlatform = navigator.platform.toLowerCase();
    showEmojiShortcut(localPlatform.includes("win") ? "win" : localPlatform.includes("mac") ? "mac" : "other");
  }

  function values() {
    const data = new FormData(form);
    return sanitizeSettings(Object.fromEntries(data.entries()));
  }

  function validate() {
    const thresholdValid = thresholdValue.value !== "" && Number(thresholdValue.value) >= 1 && Number(thresholdValue.value) <= 999;
    const customSelected = form.elements.indicatorMode.value === "custom";
    const customValid = !customSelected || customText.value.trim().length > 0;
    thresholdValue.setAttribute("aria-invalid", String(!thresholdValid));
    customText.setAttribute("aria-invalid", String(!customValid));
    thresholdError.textContent = thresholdValid ? "" : "Enter a number from 1 to 999.";
    customError.textContent = customValid ? "" : "Enter at least one character.";
    return thresholdValid && customValid;
  }

  function updateView() {
    const settings = values();
    const custom = settings.indicatorMode === "custom";
    customRow.hidden = !custom;
    const mark = custom ? expandCustomText(settings.customText || "custom", 5 * DAY) : "5d";
    preview.textContent = `${mark} · Page title`;
    preview.classList.remove("changed");
    requestAnimationFrame(() => preview.classList.add("changed"));
    validate();
  }

  async function save() {
    if (!validate()) return;
    saveState.textContent = "Saving…";
    try {
      await localStore.set({ settings: values() });
      saveState.textContent = "Saved locally";
    } catch (_) {
      saveState.textContent = "Could not save. Try changing the setting again.";
    }
  }

  function queueSave() {
    updateView();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 180);
  }

  async function restore() {
    const stored = await localStore.get("settings");
    const settings = sanitizeSettings(stored.settings ?? DEFAULT_SETTINGS);
    for (const [name, value] of Object.entries(settings)) {
      const control = form.elements[name];
      if (control instanceof RadioNodeList) {
        for (const radio of control) radio.checked = radio.value === value;
      } else if (control) {
        control.value = value;
      }
    }
    updateView();
  }

  form.addEventListener("input", queueSave);
  form.addEventListener("change", queueSave);
  loadPlatformHint();
  restore().catch(() => { saveState.textContent = "Could not load settings"; });
})();
