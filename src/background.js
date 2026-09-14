(function startPatinaBackground() {
  "use strict";

  if (!globalThis.PatinaTime && typeof importScripts === "function") {
    importScripts("shared/time.js");
  }

  const api = globalThis.browser ?? globalThis.chrome;
  const { DEFAULT_SETTINGS, nextChangeAt, sanitizeSettings } = globalThis.PatinaTime;
  const TAB_STATE_KEY = "patina.tab-state.v1";
  const FALLBACK_KEY = "patina.tab-state-fallback.v1";
  const SETTINGS_KEY = "settings";
  const ALARM_NAME = "patina.next-title-update";
  let operation = Promise.resolve();
  let fallbackMapPromise;

  function serialize(task) {
    operation = operation.then(task, task);
    return operation;
  }

  async function getSettings() {
    const stored = await api.storage.local.get(SETTINGS_KEY);
    return sanitizeSettings(stored[SETTINGS_KEY] ?? DEFAULT_SETTINGS);
  }

  async function getFallbackMap() {
    if (!fallbackMapPromise) {
      const area = api.storage.session ?? api.storage.local;
      fallbackMapPromise = area.get(FALLBACK_KEY).then((stored) => stored[FALLBACK_KEY] ?? {});
    }
    return fallbackMapPromise;
  }

  async function setFallbackState(tabId, state) {
    const map = await getFallbackMap();
    map[String(tabId)] = state;
    const area = api.storage.session ?? api.storage.local;
    await area.set({ [FALLBACK_KEY]: map });
  }

  async function getTabState(tabId) {
    if (typeof api.sessions?.getTabValue === "function") {
      try {
        const state = await api.sessions.getTabValue(tabId, TAB_STATE_KEY);
        if (state && Number.isFinite(state.openedAt) && Number.isFinite(state.lastViewedAt)) {
          return state;
        }
      } catch (_) {
        // A disappearing tab can reject between an event and this lookup.
      }
    }
    const map = await getFallbackMap();
    return map[String(tabId)] ?? null;
  }

  async function setTabState(tabId, state) {
    if (typeof api.sessions?.setTabValue === "function") {
      try {
        await api.sessions.setTabValue(tabId, TAB_STATE_KEY, state);
        return;
      } catch (_) {
        // Fall through when a tab disappears or the API is unavailable.
      }
    }
    await setFallbackState(tabId, state);
  }

  async function ensureTabState(tab, now = Date.now()) {
    if (!Number.isInteger(tab?.id)) return null;
    const existing = await getTabState(tab.id);
    if (existing) return existing;
    const restoredBaseline = Number.isFinite(tab.lastAccessed)
      ? Math.min(now, tab.lastAccessed)
      : now;
    const state = { openedAt: restoredBaseline, lastViewedAt: restoredBaseline };
    await setTabState(tab.id, state);
    return state;
  }

  async function payloadForTab(tab, now = Date.now()) {
    const [settings, state] = await Promise.all([getSettings(), ensureTabState(tab, now)]);
    if (!state) return null;
    const startedAt = settings.ageMode === "viewed" ? state.lastViewedAt : state.openedAt;
    return {
      type: "patina:render",
      now,
      settings,
      startedAt,
      titleState: state.titleState ?? null
    };
  }

  function sanitizeTitleState(value) {
    if (typeof value?.originalTitle !== "string" || typeof value?.appliedTitle !== "string") {
      return null;
    }
    return {
      originalTitle: value.originalTitle.slice(0, 8192),
      appliedTitle: value.appliedTitle.slice(0, 8192)
    };
  }

  async function rememberTitleState(tab, value) {
    const titleState = sanitizeTitleState(value);
    if (!titleState) return;
    const state = await ensureTabState(tab);
    if (!state) return;
    await setTabState(tab.id, { ...state, titleState });
  }

  async function updateTab(tab, now = Date.now()) {
    const payload = await payloadForTab(tab, now);
    if (!payload) return;
    try {
      await api.tabs.sendMessage(tab.id, payload);
    } catch (_) {
      // Restricted browser pages do not host the content script.
    }
  }

  async function updateAllTabs() {
    const now = Date.now();
    const tabs = await api.tabs.query({});
    await Promise.all(tabs.map((tab) => updateTab(tab, now)));
    await scheduleNext(tabs, now);
  }

  async function scheduleNext(tabs, now = Date.now()) {
    const settings = await getSettings();
    const candidates = await Promise.all(tabs.map(async (tab) => {
      const state = await ensureTabState(tab, now);
      if (!state) return null;
      const startedAt = settings.ageMode === "viewed" ? state.lastViewedAt : state.openedAt;
      return nextChangeAt(startedAt, now, settings);
    }));
    const future = candidates.filter((time) => Number.isFinite(time) && time > now);
    await api.alarms.clear(ALARM_NAME);
    if (future.length) {
      await api.alarms.create(ALARM_NAME, { when: Math.max(now + 1000, Math.min(...future)) });
    }
  }

  async function markViewed(tabId) {
    const tab = await api.tabs.get(tabId);
    const state = await ensureTabState(tab);
    if (!state) return;
    const updated = { ...state, lastViewedAt: Date.now() };
    await setTabState(tabId, updated);
    await updateTab(tab);
    await scheduleNext(await api.tabs.query({}));
  }

  api.runtime.onInstalled.addListener((details) => serialize(async () => {
    if (details.reason === "install") await api.runtime.openOptionsPage();
    await updateAllTabs();
  }));
  api.runtime.onStartup.addListener(() => serialize(async () => {
    const tabs = await api.tabs.query({});
    const now = Date.now();
    await Promise.all(tabs.map(async (tab) => {
      const state = await ensureTabState(tab, now);
      if (tab.active && state) await setTabState(tab.id, { ...state, lastViewedAt: now });
    }));
    await updateAllTabs();
  }));

  api.tabs.onCreated.addListener((tab) => serialize(async () => {
    if (Number.isInteger(tab.openerTabId)) {
      const now = Date.now();
      await setTabState(tab.id, { openedAt: now, lastViewedAt: now });
    } else {
      await ensureTabState(tab);
    }
    await scheduleNext(await api.tabs.query({}));
  }));
  api.tabs.onActivated.addListener(({ tabId }) => serialize(() => markViewed(tabId)));
  api.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === api.windows.WINDOW_ID_NONE) return;
    serialize(async () => {
      const [tab] = await api.tabs.query({ active: true, windowId });
      if (tab?.id) await markViewed(tab.id);
    });
  });
  api.tabs.onRemoved.addListener((tabId) => serialize(async () => {
    const map = await getFallbackMap();
    if (Object.hasOwn(map, String(tabId))) {
      delete map[String(tabId)];
      const area = api.storage.session ?? api.storage.local;
      await area.set({ [FALLBACK_KEY]: map });
    }
    await scheduleNext(await api.tabs.query({}));
  }));

  api.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) serialize(updateAllTabs);
  });

  api.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[SETTINGS_KEY]) serialize(updateAllTabs);
  });

  api.action.onClicked.addListener(() => api.runtime.openOptionsPage());

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!sender.tab) return false;
    if (message?.type === "patina:ready") {
      serialize(() => payloadForTab(sender.tab)).then(sendResponse, () => sendResponse(null));
      return true;
    }
    if (message?.type === "patina:title-state") {
      serialize(() => rememberTitleState(sender.tab, message.titleState))
        .then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
      return true;
    }
    return false;
  });

  serialize(updateAllTabs);
})();
