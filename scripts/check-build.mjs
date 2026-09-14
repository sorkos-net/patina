import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

for (const target of ["chrome", "firefox"]) {
  const manifest = JSON.parse(await readFile(`dist/${target}/manifest.json`, "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "Patina");
  const sizes = target === "firefox" ? [16, 32, 48, 96, 128] : [16, 32, 48, 128];
  for (const size of sizes) {
    const icon = await stat(`dist/${target}/icons/icon-${size}.png`);
    assert(icon.size > 50, `${target} ${size}px icon is missing or empty`);
  }
}

const chrome = JSON.parse(await readFile("dist/chrome/manifest.json", "utf8"));
const firefox = JSON.parse(await readFile("dist/firefox/manifest.json", "utf8"));
assert.equal(chrome.background.service_worker, "background.js");
assert.deepEqual(firefox.background.scripts, ["shared/time.js", "background.js"]);
assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions.required, ["none"]);
assert(!chrome.permissions.includes("sessions"), "Chrome must not request its unrelated sessions API");
assert(firefox.permissions.includes("sessions"), "Firefox needs sessions for per-tab restore values");
assert.equal(chrome.version, firefox.version);
console.log(`Build checks passed for Patina ${chrome.version}`);
