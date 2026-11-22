# CV Studio

A local-first CV editor. The original CV files remain in the parent directory.
The app starts with fictional example data; import your original CV locally.

## Run locally

Install Node.js 22.13+ (22.x) or Node.js 24.x, then in PowerShell:

```powershell
cd E:\Workspace\cv\app
npm ci
npm run dev
```

Open the local address printed in the terminal. Keep the terminal open while
using the app. Use the same address and port each time: browser storage is
specific to the site's origin and browser profile.

## Run on your local network

The LAN server builds and serves only the production files in `dist`. It uses
Caddy for HTTPS and a private local certificate authority; do not expose the
Vite development server as a permanent LAN service.

1. Install Caddy for Windows and make `caddy` available on `PATH`.
2. Reserve the host PC's LAN IPv4 address in the router.
3. Set `CV_STUDIO_HOST` to that reserved IP, then start the server:

   ```powershell
   $env:CV_STUDIO_HOST = "192.168.0.100"
   npm run start:lan
   ```

4. Open `https://192.168.0.100` or `https://<your-reserved-lan-ip>` on each
   device. The Caddyfile prevents automatic trust-store changes. While the
   server runs, run `caddy trust` to trust its local certificate authority on
   the host. Use elevated PowerShell only if Windows requires it.
5. Install Caddy's public `root.crt` as a trusted certificate authority on
   each other device. Find it in Caddy's data directory. Never copy or
   distribute `root.key`.
6. Replace any broad Caddy firewall exception with an inbound TCP 443 rule
   limited to the host's LAN IP and trusted subnet. Run firewall changes from
   elevated PowerShell; if policy blocks local rules, ask IT. Do not disable
   the firewall or allow all ports and remote addresses.

The server stops when its terminal closes; press Ctrl+C to stop it. HTTPS works
only on devices that trust Caddy's local root certificate. LAN access does not
sync CV data: each browser profile keeps its own IndexedDB records.

Under **Start with your existing CV**, choose the original
`E:\Workspace\cv\index.html` and confirm the import. The import creates a new
local CV and does not change the original. It preserves the original dates,
skills, language percentages, roles, bullets, and consent text. Review them
for accuracy; the app does not guess whether older information is current.
The original references a missing photo, so add one only if desired.

You can also import a text-based PDF CV. PDF text is extracted in the browser,
then common English and Polish headings map content into the matching editor
sections. Review and correct imported fields. Scanned PDFs and embedded photos
are not imported; OCR is not supported.

## Editing and backup

- Use the editor panels to edit text, add or reorder entries, and switch
  between CVs. Changes save automatically when local storage is available.
- **Duplicate** creates a separate CV. **Reset CV** restores the version when
  that CV was created or imported. Deletion and reset require confirmation.
- **Export JSON** creates a backup including the optional photo. Importing
  a JSON backup creates a separate CV instead of replacing existing documents.
- Data stays in IndexedDB for the current browser profile. It is not synced,
  and clearing site data or using private browsing may delete it. Anyone with
  access to the profile or exported backup may be able to read it.
- Avoid editing the same CV in multiple tabs at once; the last save wins.
- If storage fails, the app reports that edits are not saved. Export a JSON
  backup before closing the page. A corrupt storage record is not overwritten
  automatically; recover existing data before clearing site storage.
- Imported files are limited to 5 MB; uploaded PNG, JPEG, or WebP photos to
  2 MB. No photo is included unless you choose one.

## Print and PDF

Select **Print**, or **Save as PDF** and choose your browser's PDF destination.
Both open the browser print dialog; neither can select a printer or save a PDF
without your confirmation. Ctrl+P also uses the print stylesheet.

Use A4 portrait, 100% scale, and disable browser headers and footers. The
Classic and Timeline layouts preview and print connected two-column A4
pages. Timeline uses a warm left rail for contacts, skills, and languages;
the name, summary, work history, and education appear in the right column.
Left-column content appears on the first page; longer right-column content
continues on additional pages. The optional consent statement sits at the
bottom of the final page. Choose a readable experience text size of 10.5, 10,
or 9.5 pt in the Experience editor. If the first-page left column or consent
is too long to fit, shorten it before printing. Classic and Timeline PDF pages
extend to the paper edges; physical printing requires a printer that supports
borderless A4. Select **None** for margins in the print dialog if needed.
Otherwise the printer may leave a border or shrink the page. The ATS layout
prints in a single column with margins.
Check the browser print preview: printers, browser settings, and versions may
affect the final output.
The Classic header and consent footer request their dark backgrounds in print.
Timeline requests its warm left-rail background. Enable background graphics if
needed and check that text remains readable.

## Build, test, and publish

```powershell
npm run build
npm test
npm run test:e2e
```

Browser tests use installed Google Chrome and inspect generated PDF pages.
The production files are in `app\dist`. If hosting publicly, publish only
the contents of `dist`, not the repository root, original CV, images, local
backups, or private files. Review the build before publishing. The repository
and its Git history may already contain personal information.
Use HTTPS for hosted copies to protect app code from network tampering. ID
generation falls back to `crypto.getRandomValues` on HTTP LAN origins, but
HTTPS remains recommended.

The app does not upload CV data or request external fonts. Running the local
server does not require internet access after dependencies are installed.
Hosted offline use is not guaranteed. There is no account or cloud sync.
