(function startPatinaTitleLayer() {
  "use strict";

  const api = globalThis.browser ?? globalThis.chrome;
  const { prefix } = globalThis.PatinaTime;
  const titleLayer = new globalThis.PatinaTitle.TitleLayer(document.title);
  const ORIGINAL_ATTRIBUTE = "data-patina-original-title";
  const APPLIED_ATTRIBUTE = "data-patina-applied-title";
  const checkedTitleElements = new WeakSet();
  let latestPayload = null;
  let applying = false;
  let provenanceRestored = false;
  let lastPersistedState = "";

  function restoreFromTitleElement() {
    const titleElement = document.querySelector("title");
    if (!titleElement || checkedTitleElements.has(titleElement)) return false;
    checkedTitleElements.add(titleElement);
    const restored = titleLayer.restore({
      originalTitle: titleElement.getAttribute(ORIGINAL_ATTRIBUTE),
      appliedTitle: titleElement.getAttribute(APPLIED_ATTRIBUTE)
    });
    if (restored) provenanceRestored = true;
    return restored;
  }

  function persistTitleState() {
    const titleState = titleLayer.snapshot();
    const titleElement = document.querySelector("title");
    if (titleElement) {
      if (titleElement.getAttribute(ORIGINAL_ATTRIBUTE) !== titleState.originalTitle) {
        titleElement.setAttribute(ORIGINAL_ATTRIBUTE, titleState.originalTitle);
      }
      if (titleElement.getAttribute(APPLIED_ATTRIBUTE) !== titleState.appliedTitle) {
        titleElement.setAttribute(APPLIED_ATTRIBUTE, titleState.appliedTitle);
      }
      checkedTitleElements.add(titleElement);
    }
    const serialized = JSON.stringify(titleState);
    if (serialized === lastPersistedState) return;
    lastPersistedState = serialized;
    api.runtime.sendMessage({ type: "patina:title-state", titleState }).catch(() => {});
  }

  function captureSiteTitle() {
    const current = document.title;
    if (applying) return;
    titleLayer.capture(current);
  }

  function render(payload = latestPayload) {
    if (!payload) return;
    latestPayload = payload;
    if (!provenanceRestored) {
      if (!restoreFromTitleElement()) titleLayer.restore(payload.titleState);
      provenanceRestored = true;
    }
    captureSiteTitle();
    const age = Math.max(0, payload.now - payload.startedAt);
    const owned = prefix(age, payload.settings);
    const desired = titleLayer.compose(document.title, owned);
    if (document.title === desired) {
      persistTitleState();
      return;
    }
    applying = true;
    document.title = desired;
    persistTitleState();
    queueMicrotask(() => { applying = false; });
  }

  let observingHead = false;
  const observer = new MutationObserver(() => {
    restoreFromTitleElement();
    if (!observingHead && document.head) observeTitleBoundary();
    queueMicrotask(() => {
      if (document.title === titleLayer.appliedTitle) {
        persistTitleState();
        return;
      }
      captureSiteTitle();
      render();
    });
  });

  function observeTitleBoundary() {
    observer.disconnect();
    if (document.head) {
      observingHead = true;
      observer.observe(document.head, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: [ORIGINAL_ATTRIBUTE, APPLIED_ATTRIBUTE]
      });
    } else {
      observer.observe(document, { childList: true, subtree: true });
    }
  }

  observeTitleBoundary();

  api.runtime.onMessage.addListener((message) => {
    if (message?.type === "patina:render") render(message);
  });

  api.runtime.sendMessage({ type: "patina:ready" })
    .then((response) => {
      if (response?.type === "patina:render") render(response);
    })
    .catch(() => {});
})();
