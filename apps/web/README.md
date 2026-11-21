# Transly web app (`apps/web`)

The browser frontend for Transly: upload a document (photo or PDF), check the extracted text, review the
machine translation side by side, optionally send it to a human translator, and issue a PDF with a QR code
that anyone can check on the public verification page (`/v/<id>`). Languages: Afaan Oromo, Amharic, English.

Built mobile-first (Android phones around 360–400 px wide) with React 19, Vite, TypeScript and Tailwind CSS.
PDFs are created in the browser with pdf-lib (Noto Sans and Noto Sans Ethiopic fonts in `public/fonts`).
Shared request/response types come from `shared/contract.ts` through the `@shared` alias (owned by the project lead;
do not edit it from here).

## Requirements

- Node.js 20.19+ or 22.12+ (developed with Node 24) and npm
- A modern browser (Chrome on Android is the main target)

## Install

```bash
cd apps/web
npm install
cp .env.example .env    # then fill in the values, see below
```

## Develop

```bash
npm run dev             # http://localhost:5173
```

## Build

```bash
npx tsc -b              # type check only
npm run build           # type check + production build into dist/
npm run preview         # serve the built dist/ locally
```

## Environment variables

Only these three, all in `apps/web/.env` (never commit `.env`):

| Name | Meaning |
| --- | --- |
| `VITE_USE_MOCKS` | `true` = mock mode (no backend). Anything else = real mode. |
| `VITE_SUPABASE_URL` | Supabase project URL (real mode only). |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key (real mode only). |

No service-role key and no AI (Gemini) key ever belong in the frontend.

## Mock mode

Set `VITE_USE_MOCKS=true` and restart `npm run dev`. A yellow **MOCK DATA** bar is shown on every page.
Everything is fake and stored in the browser's localStorage (`transly.mock.db.v1`):

- **Login:** any email and password works. An email containing `translator` signs in as a translator
  (shows the review queue).
- **Failure triggers:** upload a file whose name contains `<kind>-<stage>`, e.g. `rate-extract.png`.
  - Stages: `upload`, `extract`, `translate`, `reserve`, `complete`.
  - Kinds: `fail` (503, fails once), `rate` (429, fails once), `down` (500, always), `lang` (422 unsupported
    language), `auth` (401), `big` (413), `bad` (422).
- **Daily limit:** a file name containing `daily` makes extract and translate fail with `RATE_LIMITED` and a
  "Daily limit reached" message (no Retry button, as for any rate-limit message that mentions a daily limit).
- **Slow triggers:** a file name containing `slow` makes extract and translate wait 8 s. A name containing
  `hang` makes them never answer, so the client timeout appears. To see it sooner, run
  `localStorage.setItem('transly.mock.timeoutMs', '5000')` in the browser console (mock mode only; default is 150 s).
- **Verify page:** `/v/revoked-demo` shows a revoked document, `/v/missing-demo` a not-found one.
- To start fresh, clear the site's localStorage.

## What the frontend already handles

- Upload: JPG, PNG and PDF only (detected from the file's bytes, not its name). Photos are rotated upright
  (EXIF), shrunk to at most 2000 px on the longest side and re-encoded as JPEG (quality 0.85). PDFs stay as they
  are, up to 8 MB. Empty, unsupported, damaged and oversized files get a clear message; very small or very
  narrow pictures get a warning that the text may be unreadable.
- No double submits for upload, extract, translate, human review and issuing.
- Extract and translate show a progress screen with elapsed seconds and stop waiting after 150 s with a Retry button.
- Errors from the API (`{ error: { code, message } }`) are shown in plain language, with Retry when it can help.
- Line breaks inside a text block are kept in the editors and in the PDF.

## Current limitations

- Real mode (Supabase and `/api`) has not been tested end to end yet; it waits for the backend.
- The issued PDF is kept in memory only. After a reload it can only be downloaded again if it was made public.
- Which verification ID belongs to which document is remembered per device (localStorage), so "View" in
  *My documents* and the Revoke button only appear in the browser that issued the document.
- Uploads to Supabase Storage have no client timeout or upload progress bar yet.
- Phones usually cannot show a PDF inside the page; there the preview starts collapsed and Download is offered.
- Payments are a placeholder.
- Tested in the Chromium-based Cursor browser with phone emulation (360 px) only. Not yet tested on Firefox,
  Safari or a real Android phone.
