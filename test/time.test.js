import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({});
vm.runInContext(await readFile("src/shared/time.js", "utf8"), context);
vm.runInContext(await readFile("src/shared/title.js", "utf8"), context);
const time = context.PatinaTime;
const { TitleLayer } = context.PatinaTitle;

test("uses automatic relative units without seconds", () => {
  assert.equal(time.relativeAge(17 * time.MINUTE), "17m");
  assert.equal(time.relativeAge(4 * time.HOUR), "4h");
  assert.equal(time.relativeAge(3 * time.DAY), "3d");
  assert.equal(time.relativeAge(15 * time.DAY), "2w");
  assert.equal(time.relativeAge(151 * time.DAY), "5mo");
});

test("shows nothing before the configured threshold", () => {
  const settings = { thresholdValue: 3, thresholdUnit: "hours" };
  assert.equal(time.prefix(179 * time.MINUTE, settings), "");
  assert.equal(time.prefix(3 * time.HOUR, settings), "3h · ");
});

test("custom text uses the same unbracketed prefix format", () => {
  const settings = {
    thresholdValue: 1,
    thresholdUnit: "minutes",
    indicatorMode: "custom",
    customText: "🍂"
  };
  assert.equal(time.prefix(time.MINUTE, settings), "🍂 · ");
  assert.equal(time.nextChangeAt(0, time.MINUTE, settings), null);
});

test("custom templates expand age, number, and unit variables", () => {
  const settings = {
    thresholdValue: 1,
    thresholdUnit: "minutes",
    indicatorMode: "custom",
    customText: "stale {{age}} / {{age_number}} {{age_unit}}"
  };
  assert.equal(time.prefix(13 * time.MINUTE, settings), "stale 13m / 13 m · ");
  assert.equal(time.prefix(3 * time.DAY, settings), "stale 3d / 3 d · ");
});

test("custom templates update only when they contain an age variable", () => {
  const staticSettings = {
    thresholdValue: 1,
    thresholdUnit: "minutes",
    indicatorMode: "custom",
    customText: "old"
  };
  const dynamicSettings = { ...staticSettings, customText: "{{age_number}}{{age_unit}} old" };
  assert.equal(time.nextChangeAt(0, 13.5 * time.MINUTE, staticSettings), null);
  assert.equal(time.nextChangeAt(0, 13.5 * time.MINUTE, dynamicSettings), 14 * time.MINUTE);
});

test("unknown custom-template variables remain literal", () => {
  assert.equal(time.expandCustomText("{{age}} {{mystery}}", 4 * time.HOUR), "4h {{mystery}}");
});

test("schedules the next visible boundary", () => {
  const settings = { thresholdValue: 15, thresholdUnit: "minutes" };
  assert.equal(time.nextChangeAt(0, 10 * time.MINUTE, settings), 15 * time.MINUTE);
  assert.equal(time.nextChangeAt(0, 17.5 * time.MINUTE, settings), 18 * time.MINUTE);
  assert.equal(time.nextChangeAt(0, 4.2 * time.HOUR, settings), 5 * time.HOUR);
  assert.equal(time.nextChangeAt(0, 59 * time.DAY, settings), 60 * time.DAY);
});

test("sanitizes persisted and user-entered settings", () => {
  const settings = time.sanitizeSettings({
    thresholdValue: 0,
    thresholdUnit: "years",
    ageMode: "anything",
    indicatorMode: "custom",
    customText: `  ${"x".repeat(40)}  `
  });
  assert.equal(settings.thresholdValue, 1);
  assert.equal(settings.thresholdUnit, "minutes");
  assert.equal(settings.ageMode, "opened");
  assert.equal(settings.customText.length, 40);
});

test("title layer follows website title changes without duplicating itself", () => {
  const layer = new TitleLayer("Inbox");
  assert.equal(layer.compose("Inbox", "5d · "), "5d · Inbox");
  assert.equal(layer.compose("5d · Inbox", "5d · "), "5d · Inbox");
  assert.equal(layer.compose("(2) 5d · Inbox", "5d · "), "5d · (2) Inbox");
  assert.equal(layer.compose("Project board", "6d · "), "6d · Project board");
  assert.equal(layer.compose("6d · Project board", ""), "Project board");
});

test("title layer restores provenance after a content-script reload", () => {
  const firstLayer = new TitleLayer("Inbox");
  assert.equal(firstLayer.compose("Inbox", "54m · "), "54m · Inbox");

  const reloadedLayer = new TitleLayer("54m · Inbox");
  assert.equal(reloadedLayer.restore(firstLayer.snapshot()), true);
  assert.equal(reloadedLayer.compose("54m · Inbox", "58m · "), "58m · Inbox");
});

test("title layer does not erase marker-like text authored by a website", () => {
  const layer = new TitleLayer("Inbox");
  layer.compose("Inbox", "5d · ");
  assert.equal(layer.compose("Forecast: 5d · rain", "6d · "), "6d · Forecast: 5d · rain");
  assert.equal(layer.compose("5d · Weather outlook", "6d · "), "6d · 5d · Weather outlook");
});
