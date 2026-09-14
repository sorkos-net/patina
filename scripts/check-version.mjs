import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
assert(tag, "Pass a version tag such as v0.1.0");
const version = tag.replace(/^v/, "");
const files = ["package.json", "src/manifest.chrome.json", "src/manifest.firefox.json"];
for (const file of files) {
  const contents = JSON.parse(await readFile(file, "utf8"));
  assert.equal(contents.version, version, `${file} version must match ${tag}`);
}
console.log(`Version ${version} matches ${tag}`);
