# DraftWeaver

DraftWeaver is a focused Nostr long-form studio designed to take existing WordPress content and publish it as clean, standards-compliant NIP-23 (kind 30023) articles.

It runs as a modern React/Vite/Tailwind/shadcn-ui Nostr client, built to:
- Import posts directly from a WordPress URL via the REST API
- Convert WordPress HTML content (including images) to markdown
- Map metadata (title, d-tag, summary, cover image, canonical URL, tags)
- Show a precise live preview of the resulting long-form article and its Nostr event payload
- Publish the final NIP-23 event to configured Nostr relays

## Core Features

- WordPress → NIP-23 pipeline
  - Paste any public WordPress post URL.
  - Uses the WordPress REST API (with `_embed=1` when resolving by slug).
  - Extracts:
    - Title
    - HTML content
    - Excerpt → used as summary
    - Canonical link (`post.link`)
    - Featured image (Jetpack or embedded `wp:featuredmedia`)
    - `post_tag` taxonomy for tags

- HTML → Markdown conversion
  - Custom converter at `src/lib/htmlToMarkdown.ts`:
    - Handles headings, paragraphs, lists, bold/italic, code blocks, links, images.
    - Resolves relative image and link URLs against the originating post URL:
      - Absolute URLs remain unchanged.
      - `/path` URLs are prefixed with the site origin.
      - `relative.jpg` URLs are resolved against the post's directory path.
  - Output markdown becomes the `content` of the NIP-23 event.

- Clean NIP-23 event generation
  - Kind: `30023`
  - Content: markdown body.
  - Tags include (when applicable):
    - `d` – identifier (slugified, unicode-safe, derived from title or canonical URL)
    - `title` – article title
    - `summary` – short summary (from excerpt or manual)
    - `image` – cover image URL
    - `r` – canonical URL back to the original WordPress post
    - `t` – one or more topic tags (from WordPress tags + user edits)
    - `alt` – human-readable description of the event
    - `client` – `draftweaver`
    - `author` – npub (derived from logged-in pubkey when available)

- Live Studio UI (`/draftweaver`)
  - Three key zones:
    1. Import
       - WordPress URL input + Import button
       - Markdown / Original HTML tabs
    2. Mapping
       - Editable:
         - Title
         - Identifier (d tag)
         - Summary
         - Cover Image URL
         - Canonical URL
         - Tags (comma-separated, fully editable)
         - Markdown content
       - All changes immediately update the event preview.
    3. Preview & Payload
       - Left: Long-form article preview (markdown-rendered, dark theme).
       - Right: Exact NIP-23 payload viewer (JSON + tags-only view).

- Publishing
  - Uses `useNostrPublish` and the app's `NostrProvider`.
  - Requires login via the existing Nostr login flow (NIP-07-style signer).
  - Publishes to all configured write-enabled relays.
  - Default relay configuration (can be changed by the user):
    - `wss://relay.damus.io`

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS + `tailwindcss-animate`
- shadcn/ui components
- Radix UI primitives
- TanStack Query (React Query)
- Nostrify (`@nostrify/nostrify`, `@nostrify/react`)
- Nostr Login via `@nostrify/react/login`

## Key Files

- `src/App.tsx`
  - Global providers: AppProvider, NostrProvider, NostrSync, NWCProvider, DMProvider, Unhead, QueryClient, etc.
  - Sets default relay configuration.

- `src/AppRouter.tsx`
  - Routes:
    - `/` → `Index` (landing page)
    - `/draftweaver` → `DraftWeaverPage` (main studio)
    - `/:nip19` → `NIP19Page` (NIP-19-aware routing)
    - `*` → `NotFound`

- `src/pages/Index.tsx`
  - Marketing/landing page.
  - Explains the three-step flow: Import → Map → Publish.
  - Links to `/draftweaver`.
  - Includes "Vibed with MKStack" link.

- `src/pages/DraftWeaver.tsx`
  - Full DraftWeaver Studio implementation.
  - Handles WordPress import, markdown conversion, mapping, preview, and publishing.

- `src/lib/htmlToMarkdown.ts`
  - Custom HTML → Markdown converter with proper URL resolution.

- `src/lib/markdown.ts`
  - Lightweight markdown → HTML renderer for preview only.

- `src/hooks/useNostrPublish.ts`
  - Wraps Nostrify publish with signer integration and clearer error handling.

- `src/components/NostrProvider.tsx`
  - Nostr pool configuration using `NPool` and relay metadata.

## Nostr & NIP-23

DraftWeaver is designed to be interoperable with NIP-23-compatible clients:

- Uses kind `30023` for long-form content.
- Keeps queryable metadata in tags, not JSON blobs in `content`.
- Generates reasonable `d` identifiers and includes an `alt` tag for human-readable context.
- Leaves relay selection to the user, with a sensible default.

## Development

Install dependencies:

```bash
npm install
```

Start dev server:

```bash
npm run dev
```

Type-check:

```bash
npm run test -- --runInBand=false
```

(Repo is configured so `npm run test` runs TypeScript, ESLint, Vitest, and a production build.)

## Notes

- This project is optimized for use inside the Shakespeare environment, but the codebase is a standard React/Vite app that can be deployed anywhere.
- Project files are tailored to build a polished, dark-mode, production-ready interface with strong accessibility defaults.
- If you add new Nostr kinds or protocol extensions, document them in `NIP.md`.
