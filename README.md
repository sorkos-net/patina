# Patina

Patina shows the age of old tabs at the beginning of their titles:

```text
5d · Original page title
```

New tabs remain untouched until the threshold you choose. Age can mean either time since the tab was opened or time since it was last viewed. The indicator can be an automatic relative age (`17m`, `4h`, `3d`, `2w`, `5mo`) or your own text, emoji, or template. Custom templates support `{{age}}`, `{{age_number}}`, and `{{age_unit}}`—for example, `stale {{age}}` becomes `stale 13m`.

On first installation, Patina opens its settings page automatically. Updates do not interrupt you.

## Privacy and permissions

Patina has no analytics, telemetry, backend, or network requests. Settings and tab timestamps stay in browser-managed local/session storage.

- **Access to all websites** is required solely for the small content script that observes and changes `document.title`. It does not read page content.
- **Sessions** (Firefox) associates timestamps with real browser tabs so restored tabs retain their exact age.
- **Storage** saves settings locally. Chrome uses suspension-safe session storage and its persisted `lastAccessed` value as a conservative baseline after restore because Chrome does not expose Firefox's per-tab session-value API. URLs are never used as tab identities.
- **Alarms** wakes the background only at the next threshold or displayed-unit boundary. There is no high-frequency timer and no seconds display.

Browser-internal pages such as `about:` and `chrome:` do not permit content scripts, so their titles cannot be changed. Firefox can preserve exact opened/viewed timestamps across session restore; Chrome preserves a meaningful lower-bound age based on the browser's own last-accessed timestamp.

Patina records the last original/rendered title pair on the page's `<title>` element and in browser-managed tab state. This lets a newly loaded content script recognize its own previous prefix after an extension reload. Tabs already carrying duplicated prefixes from an older Patina build need one normal page reload to recover the website's original title.

## Development

Requirements: Node.js 20 or newer. Supported browsers are Chrome/Chromium 121+ and Firefox 128+. There are no runtime or install-time package dependencies.

```sh
npm test
npm run build
npm run check   # tests, builds, and validates both manifests/packages
```

Build output is written to `dist/chrome` and `dist/firefox` from the shared source in `src`. Browser-specific behavior is limited to the two manifests: Chrome uses an MV3 service worker; Firefox uses MV3 background scripts. The icon master is `src/icons/icon-orig.png`; exported extension sizes are checked in beside it, while the large master is excluded from packages.

### Load in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select `dist/chrome`.

### Load in Firefox

1. Run `npm run build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on** and select `dist/firefox/manifest.json`.

## Releases and browser stores

Versions live in `package.json` and both source manifests. Push a matching tag such as `v0.2.0` to run `.github/workflows/release.yml`. The workflow validates versions, tests and packages both builds, derives GitHub release notes from conventional commits, creates a GitHub release, and submits to each configured store.

Repository secrets:

- Firefox: `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`
- Chrome: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID`, `CWS_EXTENSION_ID`

The first Chrome Web Store listing and its privacy/store metadata must be completed manually before API updates are accepted. Firefox uses `release/amo-metadata.json` for first-submission metadata. If a store's secrets are absent, that store step is skipped while packages and the GitHub release are still produced.

Use conventional commit subjects (`feat:`, `fix:`, `docs:`, `chore:`, and so on). `git-cliff` groups them into tag-specific release notes; release commits do not need to modify a generated changelog file.

## License

[MIT](LICENSE)
