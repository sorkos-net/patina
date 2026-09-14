import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "src");
const output = join(root, "dist");
const targets = ["chrome", "firefox"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const target of targets) {
  const destination = join(output, target);
  await mkdir(destination, { recursive: true });
  for (const item of ["background.js", "content.js", "options", "shared"]) {
    await cp(join(source, item), join(destination, item), { recursive: true });
  }
  await mkdir(join(destination, "icons"), { recursive: true });
  for (const size of [16, 32, 48, 96, 128]) {
    await cp(
      join(source, "icons", `icon-${size}.png`),
      join(destination, "icons", `icon-${size}.png`)
    );
  }
  const manifest = await readFile(join(source, `manifest.${target}.json`), "utf8");
  await writeFile(join(destination, "manifest.json"), manifest);
}

console.log("Built dist/chrome and dist/firefox");
