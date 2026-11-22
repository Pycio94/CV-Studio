# Editable CV engine: proposal

Status: proposal only; no application changes have been made.

## 1. Goal

Build a private, browser-based CV editor that starts with the existing CV, makes
all visible text editable, previews an A4 document, and provides dedicated
Print and Save as PDF actions. It must not depend on browser window size or
manual browser zoom to produce its intended print layout.

## 2. Review of the existing CV

### Content

- The CV already lists roles in reverse chronological order and includes
  education, languages, technical skills, and contact details.
- Check whether the role marked "Present", all dates, title, contact
  information, and technology names are still correct. Do not assume they are.
- Replace task-only descriptions and repeated technology lists with concise,
  role-relevant achievement bullets when the owner supplies the facts. Use
  measurable impact only when known; never invent metrics or experience.
- Fix spelling and capitalization, including "Proffesional Skills",
  "prepering test casses", and "Javascript". Review the whole document for
  consistent language and dates.
- Consider grouping earlier roles at the same employer and shortening older,
  less relevant experience. Preserve all original data and let the owner decide
  what to include.
- Replace percentage skill and language bars with text-based skills and
  owner-confirmed language proficiency. The current percentages have no
  defined scale and should not be converted to invented proficiency levels.
- Make the photo optional. Photo conventions and recruitment requirements vary
  by market. The HTML references `img.jpg`, while the repository contains
  `img.png`; do not assume that image is the intended photo.
- Keep the recruitment consent statement editable and optional. It may be
  useful in some contexts, but requirements vary by jurisdiction and employer;
  this plan is not legal advice.
- Add an optional short profile and project links, but do not populate them
  with invented content. Tailor the CV to each application.

### Implementation and visual design

- The existing layout uses a fixed pixel maximum width rather than A4
  dimensions. The print rule sets only `html` and `body` dimensions; it does
  not define page size, margins, page breaks, or hide editor controls.
- The two-column design has a clear visual identity, but the dark sidebar,
  bars, icons, and column reading order can be less robust for printing and
  applicant-tracking systems (ATS). Background colors may not print by default.
- The absolute-positioned footer can collide with content, especially when
  text grows. A CV must never silently clip content to preserve one page.
- HTML uses `<ui>` instead of `<ul>`, a repeated `id`, and lacks meaningful
  image alternative text. CSS contains invalid declarations such as
  `line-height: 1,4em` and `repeat(1.1fr)`.
- Google Fonts and Font Awesome currently require external network requests.
  Prefer system fonts and simple text or locally bundled assets for reliable,
  private, offline-friendly printing.

## 3. Product and UX proposal

### Editor

- Desktop: a clearly labeled editing panel beside a live document preview.
  Narrow screens: stack the panels and provide a clear Preview control; keep
  editing and printing usable without horizontal page-level scrolling.
- Group fields by Profile, Contact, Experience, Education, Skills, Languages,
  and optional consent. Every displayed text, including section titles, dates,
  links, bullet points, and the consent text, must be editable. Use labeled
  form fields rather than relying solely on `contenteditable`.
- Add, remove, and reorder repeatable entries and bullets. Confirm destructive
  deletion, provide move-up/move-down controls, and keep keyboard access.
- Provide visible Save status, Reset to original (with confirmation), and
  Import/Export JSON for backup. Import validates schema before replacing data
  and asks for confirmation; malformed input must leave current data untouched.
- Offer optional photo upload/removal, with image type and size validation.
  Preserve the original content separately from edits. Do not include an image
  until the owner selects or confirms the intended image.
- Empty optional fields and sections should disappear from the CV without
  leaving gaps. Required fields should show clear validation and not erase data.
- Header actions: **Print**, **Save as PDF**, and a compact print-settings
  help link. These actions must use the current edited data, not stale defaults.

### Layouts and accessibility

- Default: modernize the original two-column visual identity, retaining its
  blue palette and section placement while improving hierarchy, readability,
  spacing, and contrast. Prioritize readable body text, approximately
  10-11 pt or larger; do not shrink text automatically to force a page count.
- Add an **ATS-friendly** single-column option with standard headings, plain
  text skills, logical document order, and selectable text. This improves
  compatibility but cannot guarantee that every ATS parses a PDF correctly.
- Use semantic headings and lists; keep meaningful source and reading order,
  actual link text, clear focus indicators, labels, and accessible error/status
  messages. Target WCAG 2.2 AA, including at least 4.5:1 contrast for normal
  text and 3:1 for qualifying large text.
- On the screen, show the A4 page width and a practical preview. Browser
  pagination can differ from screen layout: do not promise exact page breaks
  until verified in the supported browsers. Treat print preview as the
  authoritative output and visibly warn when content exceeds the intended
  first-page area.
- Prefer one to two A4 pages when content permits, but support more pages
  rather than losing information. Avoid making a one-page CV mandatory.

## 4. A4 printing and PDF approach

- Define A4 portrait using `@page { size: A4 portrait; margin: 10mm; }`.
  The intended content area is 190 x 277 mm. Use physical units and a
  print-specific stylesheet; reset body margins, hide editor controls and
  shadows, and avoid viewport-based breakpoints affecting print.
- Design the print document as normal flowing content. Use page-break controls
  to keep headings with the following content and avoid splitting short
  entries when possible, while allowing long entries to split. Do not rely on
  an absolutely positioned footer or fixed-height overflow clipping.
- Prototype pagination early: browser fragmentation of two-column grid/flex
  layouts is inconsistent. If the legacy-style layout cannot paginate without
  loss or overlap, use an explicitly tested multi-page print layout or a clear
  single-column continuation rather than silently truncating. Both layouts
  must preserve all content and reading order.
- **Print** opens the browser print dialog for the current CV.
  **Save as PDF** opens the same dialog with guidance to select the browser's
  PDF destination. `window.print()` cannot select the destination, save a
  file directly, guarantee a successful print, or tell whether the user
  cancelled. Do not show a false success message.
- Recommend A4, portrait, 100%/default scale, no browser headers or footers,
  and backgrounds enabled when the chosen design needs them. Printer drivers,
  user overrides, unprintable margins, browser versions, and PDF destinations
  can change output; web code cannot enforce identical physical output across
  all devices. The baseline design should remain legible with backgrounds off.
- Validate the intended output in current Chrome and Edge first, then Firefox;
  document any observed differences and tested settings. Do not rely on zoom
  or viewport width for pagination. Add direct PDF generation only as a later
  option if a true one-click download becomes a requirement.

## 5. Technical design

- Start with a static client-side app: semantic HTML, modular JavaScript, and
  CSS. No backend, account, analytics, tracking, or framework is needed for
  the initial scope. Serve locally over HTTP with a documented simple static
  server; do not rely on inconsistent `file://` storage behavior.
- Separate the versioned CV data model, editor state, persistence, rendering,
  and print styles. One data model feeds both layouts and the preview so
  edits cannot diverge from printed output. Render user text as text, not
  injected HTML; validate link schemes and imported files.
- Define stable IDs and ordered collections for experience, education, skills,
  languages, and bullets. Keep section titles, display options, links, consent,
  and photo state in the model. Include a schema version and explicit
  migrations for future changes.
- Extract the old CV into a default dataset without losing facts or replacing
  uncertain information. Keep the original unchanged until the new renderer
  and defaults have been verified against it. Flag stale or ambiguous entries
  for owner review rather than silently rewriting them.
- Save edits locally, with a visible status and explicit error when storage is
  blocked, full, or unavailable. Never overwrite corrupt saved data silently.
  Store uploaded image data with the document, enforce limits, and report
  storage errors. JSON backup must round-trip all fields and image state.
- Explain that browser storage is device- and browser-specific, can be
  cleared, and is readable by other users of the same browser profile. JSON
  exports contain personal data; the user controls where they are saved.
- Keep dependencies minimal. If automated browser/PDF testing requires a
  development dependency, add and lock it deliberately; do not require a
  runtime service or upload the CV to an external provider.

## 6. Delivery phases

1. **Baseline and print spike**: preserve and inventory the original content;
   verify target A4 layout, page-break behavior, and text extraction in the
   target browsers before committing to a pagination implementation.
2. **Data and rendering**: create the versioned default data, semantic
   renderer, modernized legacy layout, ATS layout, optional photo/consent, and
   print stylesheet. Review any content corrections with the owner.
3. **Editor and persistence**: build accessible forms and repeatable sections,
   live preview, storage, reset, import/export, and recovery/error states.
4. **Print and PDF UX**: add both actions, print guidance, overflow warnings,
   and browser-specific handling verified by tests.
5. **Quality and handoff**: run the acceptance checks below, document local
   startup and usage, and explain browser/printer limitations.

## 7. Acceptance and test plan

- **Default fidelity**: original roles, dates, education, skills, languages,
  contact details, and consent survive migration; ambiguous fields are
  flagged, not guessed. The broken image reference is handled intentionally.
- **Editing**: change every field category and section title; add, reorder,
  delete, and restore entries. The preview and print output reflect the latest
  edits, including empty and long values.
- **Persistence**: reload preserves data; reset requires confirmation; a JSON
  export/import round-trip retains all fields and photo state. Test invalid
  imports, blocked/full storage, and recovery without silent data loss.
- **Print dimensions**: at several browser viewport widths and zoom levels,
  export PDFs with the documented A4/100% settings and inspect every page's
  MediaBox: approximately 595.28 x 841.89 pt (210 x 297 mm). Compare layout
  and page count at the same print settings; viewport resizing must not require
  manual shrinking. Test printing through both buttons and browser Ctrl+P.
- **Print content**: verify default, empty optional fields, long text, multiple
  pages, long unbroken URLs, missing/large photos, and backgrounds disabled.
  No clipped, overlapped, duplicated, or missing text; no unintended blank
  pages. Check extracted PDF text and reading order, not just screenshots.
- **Visual and accessible UX**: inspect print previews and PDF screenshots in
  Chrome, Edge, and Firefox; test keyboard-only editing, labels, focus, errors,
  contrast, 200% zoom, and a narrow viewport. Verify links remain useful.
- **Privacy and offline behavior**: confirm CV content is not sent to a server
  or third-party assets. After local assets are available, editing and printing
  should work without internet access.

## 8. Decisions to confirm before implementation

1. Confirm the current employment, dates, photo, language levels, and any
   factual updates or achievement metrics.
2. Confirm whether preserving the two-column design as the default and adding
   a single-column ATS option meets the intended use.
3. Confirm whether browser **Save as PDF** is sufficient, or whether a true
   direct-download PDF button is required.
4. Confirm the target browsers and whether more than two pages should be
   permitted when content exceeds the available space.

## Sources

- [University of Montana: resume guide](https://careerhub.umt.edu/resources/resume-guide-samples/) — reverse chronology, achievements, tailoring, and ATS considerations.
- [University of Texas at Dallas: building a resume](https://career.utdallas.edu/career-resource-library/building-a-resume/) — experience entries and accomplishment statements.
- [MDN: `@page`](https://developer.mozilla.org/en-US/docs/Web/CSS/@page) and [printing CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Printing) — page size, margins, and print styles.
- [MDN: `window.print()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/print) — opens the browser dialog, not a direct PDF download.
- [Chrome Developers: print margins](https://developer.chrome.com/blog/print-margins) — browser-added headers and footers.
- [W3C: WCAG contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) — text contrast thresholds.
