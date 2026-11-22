# CV engine: execution plan

Status: implementation is in `app/`. Owner content review, physical printing,
Firefox PDF dialog verification, and a complete accessibility review remain
open. This plan refines [PLAN.md](./PLAN.md): Vue and TypeScript replace its
initial plain-JavaScript recommendation.

## 1. Target and scope

Build a static, local-first CV editor for personal use and possible public use.
It must support multiple CVs, editable text, the original visual style, an
ATS-friendly alternative, A4 printing, and PDF via the browser print dialog.

### Technology

- Vue 3, TypeScript, Vite, and npm.
- Vue reactive state and composables; add Pinia only if justified by growth.
- Zod for validating imported data and schema versions.
- IndexedDB for documents and images; JSON import/export for portable backups.
- Semantic HTML and CSS, including dedicated print styles.
- Vitest for model and persistence logic; Playwright for browser workflows.
- No backend, accounts, analytics, remote fonts, or runtime cloud services.

### Product decisions

- Default layout: modernized two-column CV; offer a single-column ATS layout.
- The owner's existing CV becomes their local starting document. Public builds
  contain only a fictional example, never the owner's CV or image.
- Keep original facts and mark uncertain information for review. Do not invent
  achievements, language levels, photos, or updated employment dates.
- Print and Save as PDF both open the browser print dialog. The latter explains
  how to select a PDF destination. Direct PDF generation is out of scope.
- Allow additional pages instead of clipping or shrinking text to fit.
- Start with current Chrome and Edge; validate Firefox as well. Browser and
  printer settings can override CSS, so identical physical output across all
  devices cannot be guaranteed.

## 2. Execution order

### Phase 0: baseline and privacy

- [x] Record all existing CV fields, ordering, section names, and visual
  characteristics. Preserve the existing files until migration is verified.
- [x] Note ambiguous or stale content, including the missing `img.jpg`
  reference; do not assume `img.png` is the intended photo.
- [x] Create a fictional fixture for automated tests and public first use.
  Keep the owner's migrated data as a local, untracked JSON import.
- [x] Define a build/deployment boundary: only the generated application and
  fictional fixture ship. The original HTML, original image, private JSON,
  backups, and source maps containing private data must not enter the build.
  Verify the generated output before any publication; existing Git history and
  the legacy repository may already contain personal data.

**Done when:** an inventory exists, the legacy files remain intact, and no
personal CV data is needed in automated fixtures or a public bundle.

### Phase 1: scaffold and print feasibility

- [x] Scaffold Vue + TypeScript with Vite and npm. Add the lockfile, type-check,
  build, unit-test, and browser-test scripts.
- [ ] Create a minimal static A4 print prototype using fictional data and both
  proposed layouts. Set `@page` to A4 portrait with 10 mm margins.
- [x] Test short and multi-page content, including long entries and URLs.
  Check two-column fragmentation before choosing the final print layout.
- [x] Establish fallback: if the legacy-style layout cannot paginate safely,
  use a tested single-column continuation or other tested multi-page layout.
  Never hide overflow or make content unreadably small.

**Done when:** prototype PDFs have A4 dimensions, selectable text, and no
clipped or overlapping content in the documented test browsers.

### Phase 2: data model and migration

- [x] Define a versioned `CvDocument` schema with stable IDs: profile,
  contact links, editable section titles, experience and bullets, education,
  skills, languages, consent, image, layout choice, and visibility options.
- [x] Support ordered collections and multiple independent CV documents.
  Keep display values as authored, including legacy skill percentages until
  the owner chooses replacements.
- [x] Define migration and validation rules. Reject malformed or unsupported
  imports with a useful error; preserve existing saved data on failure.
- [x] Map the old CV to the schema without factual changes. Provide an
  explicit local import/onboarding step so the owner can start with it; then
  retain that document in IndexedDB. Public first use starts with fictional
  data or an empty CV.
- [x] Design JSON backup to round-trip all document fields and optional image
  data. Set and document practical file and image limits.

**Done when:** the owner can load the migrated CV locally, and a
fixture-based import/export round-trip retains all modeled data.

### Phase 3: document rendering

- [x] Build a shared semantic renderer driven by the document model, with
  separate legacy-inspired and single-column templates.
- [x] Render user content as text, validate link schemes, hide empty optional
  sections, and give links meaningful visible labels.
- [x] Use local/system fonts, accessible contrast, readable type, normal-flow
  footers, and page-break rules. Do not depend on printed background colors.
- [ ] Compare the local migrated document with the old CV and flag suggested
  spelling or content changes for owner approval.

**Done when:** both templates display the same complete data in logical
reading order, and neither relies on remote assets.

### Phase 4: editor and persistence

- [x] Build labeled forms for every displayed text field and section title;
  include date strings, URLs, descriptions, bullet points, and consent.
- [x] Add, delete, and reorder repeatable items; provide keyboard-operable
  controls and confirmation for destructive actions.
- [x] Add a CV list with create, duplicate, rename, delete, and switch actions.
  Switching must not discard unsaved changes.
- [x] Save edits to IndexedDB with visible saving/saved/error states. Handle
  unavailable storage, quota failures, corrupt records, and interrupted saves
  without silently replacing data. Retain the in-memory draft after failure.
- [x] Add photo upload/removal, validation, and preview; do not preload the
  uncertain legacy image. Test image persistence and JSON round-tripping.
- [x] Add validated JSON import/export and confirmed reset. Invalid imports
  must not change the current document.
- [ ] Make editor and preview usable on desktop and narrow screens, with
  accessible focus, labels, status messages, and errors.

**Done when:** edits persist after reload, all fields are editable, and failed
saves/imports are visible and recoverable without data loss.

### Phase 5: print and PDF

- [x] Add clearly labeled Print and Save as PDF buttons using current document
  state. Handle browser Ctrl+P with the same print stylesheet.
- [x] Hide editor controls in print, use A4 physical dimensions, and avoid
  viewport-dependent print layout. Use page breaks without clipping.
- [x] Warn when content may exceed the first page; describe the on-screen
  preview as approximate and browser print preview as authoritative.
- [x] Explain A4, portrait, 100% scale, headers/footers, and background
  settings. Do not claim that a cancelled dialog saved or printed a file.

**Done when:** both actions open the correct print flow and output contains the
latest edits without browser resizing or manual zoom.

### Phase 6: verification and handoff

- [x] Run type-check, production build, and focused unit and browser tests.
- [x] In Chromium, generate PDFs at multiple viewport widths using the same
  print settings; inspect every page's MediaBox (approximately 595.28 x
  841.89 pt), page count, extracted text, and visual output.
- [ ] Manually inspect print previews and PDF output in current Chrome, Edge,
  and Firefox; document versions, settings, and observed differences.
- [ ] Test empty fields, long text and URLs, multiple pages, backgrounds off,
  missing images, both layouts, and Ctrl+P. Check for missing, duplicated,
  clipped, or overlapping text and unintended blank pages.
- [ ] Test keyboard access, 200% zoom, narrow screens, labels, errors, focus,
  and WCAG AA text contrast (4.5:1 normal; 3:1 qualifying large text).
- [ ] Verify a production build contains no personal data, assets, analytics,
  or third-party requests. Test local use without network access while the
  local server is running; hosted offline use requires a separate caching
  strategy and is not promised in this phase.
- [x] Document setup, local import of the owner's CV, backups, reset,
  deployment precautions, browser storage limitations, and print settings.

**Done when:** the checks pass, limitations are documented, and the original
CV has been compared with the migrated version.

## 3. Suggested structure

```text
src/
  components/    editor controls and reusable document sections
  layouts/       legacy-inspired and ATS CV templates
  model/         schemas, migrations, and fictional default data
  persistence/   IndexedDB and JSON import/export
  styles/        screen and print CSS
tests/
  unit/          schema, migration, and persistence tests
  e2e/           editor and print workflows using fictional data
```

Final names may change during implementation. Keep the application model
independent of Vue components and keep private files outside the public build.

## 4. Release gate

Release only after every phase's completion condition is met, the owner reviews
the migrated content, and the deployment artifact is checked for personal
data. If A4 pagination fails for the two-column layout, resolve the fallback
before adding more templates or features.

## 5. Out of scope for the first release

Accounts, cloud synchronization, collaboration, a server-side database,
direct-download PDF generation, AI-written achievements, rich template
marketplaces, and guaranteed hosted offline operation.
