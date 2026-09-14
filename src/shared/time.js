(function exposePatinaTime(root) {
  "use strict";

  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;

  const DEFAULT_SETTINGS = Object.freeze({
    thresholdValue: 15,
    thresholdUnit: "minutes",
    ageMode: "opened",
    indicatorMode: "relative",
    customText: "old"
  });

  const UNIT_MS = Object.freeze({ minutes: MINUTE, hours: HOUR, days: DAY });

  function sanitizeSettings(value = {}) {
    const numeric = Number(value.thresholdValue);
    const thresholdValue = Number.isFinite(numeric)
      ? Math.min(999, Math.max(1, Math.round(numeric)))
      : DEFAULT_SETTINGS.thresholdValue;

    return {
      thresholdValue,
      thresholdUnit: Object.hasOwn(UNIT_MS, value.thresholdUnit)
        ? value.thresholdUnit
        : DEFAULT_SETTINGS.thresholdUnit,
      ageMode: value.ageMode === "viewed" ? "viewed" : "opened",
      indicatorMode: value.indicatorMode === "custom" ? "custom" : "relative",
      customText: typeof value.customText === "string"
        ? value.customText.trim().slice(0, 64)
        : DEFAULT_SETTINGS.customText
    };
  }

  function thresholdMs(settings) {
    const clean = sanitizeSettings(settings);
    return clean.thresholdValue * UNIT_MS[clean.thresholdUnit];
  }

  function relativeAgeParts(ageMs) {
    const age = Math.max(MINUTE, ageMs);
    if (age < HOUR) return { number: Math.floor(age / MINUTE), unit: "m" };
    if (age < DAY) return { number: Math.floor(age / HOUR), unit: "h" };
    if (age < 14 * DAY) return { number: Math.floor(age / DAY), unit: "d" };
    if (age < 60 * DAY) return { number: Math.floor(age / WEEK), unit: "w" };
    return { number: Math.floor(age / MONTH), unit: "mo" };
  }

  function relativeAge(ageMs) {
    const parts = relativeAgeParts(ageMs);
    return `${parts.number}${parts.unit}`;
  }

  function customTextUsesAge(template) {
    return /{{(?:age|age_number|age_unit)}}/.test(template);
  }

  function expandCustomText(template, ageMs) {
    const parts = relativeAgeParts(ageMs);
    return template
      .replaceAll("{{age}}", `${parts.number}${parts.unit}`)
      .replaceAll("{{age_number}}", String(parts.number))
      .replaceAll("{{age_unit}}", parts.unit);
  }

  function indicator(ageMs, settings) {
    const clean = sanitizeSettings(settings);
    if (ageMs < thresholdMs(clean)) return "";
    if (clean.indicatorMode === "custom") return expandCustomText(clean.customText, ageMs);
    return relativeAge(ageMs);
  }

  function prefix(ageMs, settings) {
    const value = indicator(ageMs, settings);
    return value ? `${value} · ` : "";
  }

  function nextChangeAt(startedAt, now, settings) {
    const clean = sanitizeSettings(settings);
    const thresholdAt = startedAt + thresholdMs(clean);
    if (now < thresholdAt) return thresholdAt;
    if (clean.indicatorMode === "custom" && !customTextUsesAge(clean.customText)) return null;

    const age = Math.max(0, now - startedAt);
    let step;
    if (age < HOUR) step = MINUTE;
    else if (age < DAY) step = HOUR;
    else if (age < 14 * DAY) step = DAY;
    else if (age < 60 * DAY) step = WEEK;
    else step = MONTH;

    const nextUnitChange = startedAt + (Math.floor(age / step) + 1) * step;
    if (age < 60 * DAY && step === WEEK) {
      return Math.min(nextUnitChange, startedAt + 60 * DAY);
    }
    return nextUnitChange;
  }

  root.PatinaTime = Object.freeze({
    DAY,
    DEFAULT_SETTINGS,
    HOUR,
    MINUTE,
    MONTH,
    WEEK,
    customTextUsesAge,
    expandCustomText,
    indicator,
    nextChangeAt,
    prefix,
    relativeAge,
    relativeAgeParts,
    sanitizeSettings,
    thresholdMs
  });
})(globalThis);
