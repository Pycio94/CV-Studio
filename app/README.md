# CV Studio

CV Studio is a local-first CV editor that runs in a web browser. Create CVs
from scratch, edit imported CVs, preview different layouts, and print or save
them through the browser's print dialog.

The application has no account, cloud service, or server-side CV database.
CVs stay in IndexedDB for the current browser profile and site origin. Imports
are parsed in the browser; the app does not upload CVs or request external
fonts. Original source files are not changed by importing them.

## What it does

- Create, edit, duplicate, reset, and delete multiple CVs.
- Edit profile details, contact links, experience, education, skills,
  languages, section headings, and an optional consent statement.
- Add an optional PNG, JPEG, or WebP portrait.
- Preview three layouts: Classic, ATS-friendly, and Timeline.
- Import the original CV HTML or a text-based PDF into a new editable CV.
- Export and import portable JSON backups to move CVs between devices.
- Print CVs or save them as PDFs through the browser's print interface.
- Save edits automatically in the current browser profile.

## How it works

1. Vite serves a Vue and TypeScript single-page application. The same static
   app can be built and served by Caddy for LAN access.
2. On startup, the app reads CV records from the browser's `cv-studio`
   IndexedDB database. If the database is empty, it creates a fictional
   example CV. **New CV** creates a blank document.
3. Each saved record contains the current document and a baseline copy.
   **Reset CV** restores that baseline, which is the document's state when it
   was created or imported. Editing a CV does not alter its baseline. Zod
   validates stored records and imported backups against the document schema.
4. Changes are saved automatically after about 500 ms. The editor reports
   whether changes are unsaved, saving, saved, or not saved.
5. HTML and PDF imports are parsed locally and create new records. PDF.js
   extracts selectable text; the parser maps common English and Polish
   headings into CV sections. Imported content should be reviewed and edited.
6. Vue components render the selected layout. Classic and Timeline use a
   custom paginated A4 preview; the browser handles printing and PDF output.
7. JSON backups contain both the current document and its baseline. Importing
   a backup creates another CV instead of replacing existing records.

## Importing and backing up

### Original CV HTML

Choose **Choose original CV HTML** under **Start with your existing CV**.
Select the original `index.html` in the repository root, one level above
`app`. The importer recognizes the original CV's HTML structure; it is not a
general-purpose HTML importer. It creates a separate CV and leaves the source
file unchanged. The original portrait is not imported automatically.

### PDF

Choose **Choose existing CV PDF** and confirm the import. PDF text extraction
and section mapping happen locally in the browser. The importer supports
selectable text, up to 5 MB per file and 100 pages. It recognizes common
English and Polish section headings, but mapping is heuristic; check every
field after import.

Scanned PDFs, OCR, and embedded photos are not supported. Add a portrait
separately in the Profile editor.

### JSON backup

Use **Export JSON** in **Import, backup and reset** to download a portable
backup. It includes the edited CV, its reset baseline, and any uploaded
portrait. Importing that JSON on another workstation creates a separate CV;
it does not sync or replace the source CV. Older raw-document JSON files are
also accepted.

Protect exported backups like any document containing personal information.
Import files are limited to 5 MB. Uploaded portraits must be PNG, JPEG, or
WebP and no larger than 2 MB. Text fields allow up to 10,000 characters, and
each list supports up to 100 entries.

## Editing and stored data

- CV data is stored in IndexedDB for one browser profile and one site origin.
  A different browser, private session, hostname, or port has a separate
  database. Use JSON backups to transfer CVs between devices.
- Clearing site data or using private browsing may delete CVs. The app adds
  no separate encryption layer; protect the operating-system account and
  exported backups.
- Avoid editing the same CV in multiple tabs. The last save can overwrite
  an earlier tab's changes.
- If storage fails, the app reports that edits are not saved. Export a JSON
  backup before closing the page. A corrupt storage record is not overwritten
  automatically; recover existing data before clearing site storage.
- The repository may contain original CV files or personal information.
  Inspect files and Git history before committing or publishing.
- ID generation uses `crypto.randomUUID()` when available and falls back to
  `crypto.getRandomValues()`. A secure random source is still required.

## Layouts and printing

- **Classic:** Two columns. Contacts, education, languages, and skills appear
  in the left section; profile and experience appear in the main section.
- **Timeline:** Two columns. Contacts, skills, and languages appear in the
  left rail; profile, experience, and education appear in the main section.
- **ATS-friendly:** Single-column layout for a simpler reading order.

Section headings are editable. The consent statement is optional; paginated
Classic and Timeline layouts place it at the bottom of the final page. The
experience editor offers 10.5 pt, 10 pt, and 9.5 pt text sizes.

**Print**, **Save as PDF**, and Ctrl+P use the browser's print system. The app
does not select a printer or silently save a PDF. For predictable output:

- Use A4 portrait, 100% scale, and disable browser headers and footers.
- Check the browser's print preview before printing.
- Enable background graphics to preserve the Classic header and consent
  footer or Timeline rail colors.
- Classic and Timeline pages extend to the paper edges. Physical printers
  need borderless A4 support; choose **None** for print margins if available.
- If the first-page left section or consent text does not fit, shorten it
  before printing. Longer main-column content continues on later pages.

Browser, printer, and print-dialog settings can change final output.

## Run locally

Install Node.js 22.13+ (22.x) or 24.x. From the repository root, run these
commands in PowerShell:

```powershell
Set-Location .\app
npm ci
npm run dev
```

Open the local address printed in the terminal and keep the terminal open.
The development server binds to `127.0.0.1`; it is intended for local use, not
as a permanent LAN server. Use the same address and port each time because
browser storage is scoped to the origin and browser profile.

## Build and test

Run these commands from `app`:

```powershell
npm run build
npm test
npm run test:e2e
```

The build runs the TypeScript/Vue type check before creating production files
in `dist`. Unit tests use Vitest. Browser tests use Playwright and installed
Google Chrome to exercise editor workflows and inspect generated PDF pages.
Use `npm run preview` to serve a production build locally.

## Run on your local network

The LAN server builds and serves only `dist` over HTTPS through Caddy. Do not
expose the Vite development server as a permanent LAN service.

1. Install Caddy for Windows and make `caddy` available on `PATH`.
2. Reserve the host PC's LAN IPv4 address in the router.
3. From the `app` directory, set `CV_STUDIO_HOST` to that reserved address
   and start the server:

   ```powershell
   $env:CV_STUDIO_HOST = "192.168.0.100"
   npm run start:lan
   ```

4. Open `https://192.168.0.100` (or your reserved LAN IP) on each device.
   The Caddyfile prevents automatic trust-store changes. While the server
   runs, use `caddy trust` on the host to trust its local certificate
   authority. Use elevated PowerShell only if Windows requires it.
5. On each other device, trust Caddy's `root.crt` from its data directory.
   Never copy or distribute `root.key`.
6. Limit inbound TCP 443 firewall access to the host's LAN IP and trusted
   subnet. Do not disable the firewall or allow all ports and remote
   addresses.

The server stops when its terminal closes; press Ctrl+C to stop it. HTTPS
works only on devices that trust Caddy's local root certificate. Each device
still has its own IndexedDB records; use JSON backups to transfer CVs.
ID generation supports HTTP LAN origins when `crypto.getRandomValues()` is
available, but HTTPS remains recommended for hosted copies.

For hosted copies, use HTTPS to protect the app code from network tampering
and publish only the contents of `dist`. Never publish the repository root,
original CV files, local backups, or private images. Local server use does not
require internet access after dependencies are installed; offline operation
of a hosted copy is not guaranteed.

## Project structure

- `src\App.vue` - editor state, autosave, document operations, imports,
  exports, and print actions.
- `src\model.ts` - CV document schema, validation, defaults, and helpers.
- `src\storage.ts` - IndexedDB persistence and JSON backup validation.
- `src\legacy.ts` - importer for the original CV HTML.
- `src\pdfImport.ts` and `src\pdfParser.ts` - local PDF text extraction and
  section mapping.
- `src\CvPreview.vue` - shared CV markup for the three layouts.
- `src\ClassicPrint.vue` - A4 pagination for Classic and Timeline.
- `src\style.css` - screen, layout, and print styles.
- `src\*.test.ts` and `tests\editor.spec.ts` - unit and browser tests.
