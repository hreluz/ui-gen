# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # First-time setup: install deps, generate Prisma client, run migrations
npm run dev          # Start dev server (Turbopack, http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run all tests (Vitest + jsdom)
npx vitest run src/path/to/file.test.tsx  # Run a single test file
npm run db:reset     # Reset SQLite database (destructive)
```

Set `ANTHROPIC_API_KEY` in `.env` to use the real Claude API. Without it, the app falls back to `MockLanguageModel` in `src/lib/provider.ts`.

## Architecture

UIGen is a Next.js 15 (App Router) application where users describe React components in a chat interface and see a live preview rendered in an iframe.

### Data & Persistence
- **Database**: SQLite via Prisma (`prisma/dev.db`). Two models: `User` (email/password auth) and `Project` (stores serialized chat messages and virtual file system as JSON strings in `messages`/`data` columns). Always reference `prisma/schema.prisma` to understand the structure of data stored in the database.
- **Auth**: Custom JWT-based session auth using `jose` (`src/lib/auth.ts`). Sessions stored in httpOnly cookies. `src/middleware.ts` handles route protection.
- **Anonymous users**: Work is stored in `sessionStorage` via `src/lib/anon-work-tracker.ts` and can be migrated to a project on sign-up.

### Virtual File System
`src/lib/file-system.ts` implements `VirtualFileSystem` — an in-memory tree of `FileNode` objects. No files are written to disk. The VFS is serialized to JSON and stored in the `Project.data` DB column.

`src/lib/contexts/file-system-context.tsx` wraps the VFS in a React context and exposes file operations. It also handles `handleToolCall` — routing AI tool calls (`str_replace_editor`, `file_manager`) into VFS mutations.

### AI Code Generation
- **API route**: `src/app/api/chat/route.ts` — receives messages + serialized VFS, streams responses using Vercel AI SDK's `streamText`, saves results to DB on finish.
- **Model**: `claude-haiku-4-5` via `@ai-sdk/anthropic`. `MockLanguageModel` in `src/lib/provider.ts` is used when no API key is present.
- **Tools given to the model**:
  - `str_replace_editor` (`src/lib/tools/str-replace.ts`): create/str_replace/insert/view operations on the VFS.
  - `file_manager` (`src/lib/tools/file-manager.ts`): rename and delete operations.
- **System prompt**: `src/lib/prompts/generation.tsx`.

### Live Preview
`src/components/preview/PreviewFrame.tsx` renders an iframe. `src/lib/transform/jsx-transformer.ts` handles:
1. Transpiling JSX/TSX files in-browser using `@babel/standalone`.
2. Building an ES module import map (blob URLs for local files, `esm.sh` for third-party packages).
3. Generating the preview HTML with Tailwind CDN and an error boundary.

### UI Layout
- `/` — anonymous users see the main editor; authenticated users are redirected to their most recent (or a newly created) project.
- `/[projectId]` — project-specific editor page.
- `src/app/main-content.tsx` — three-panel layout (chat | code editor + file tree | preview) using `react-resizable-panels`.
- Shadcn/ui components in `src/components/ui/`.

### Server Actions
`src/actions/` contains Next.js server actions for creating/fetching projects and getting the current user.
