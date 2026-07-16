---
name: Social Tasks Feature
description: Social media task type (follow/like/comment/repost/subscribe) with optional Gemini Vision AI screenshot verification. Full implementation written July 2026.
---

## What was built

A third task format alongside Standard and YouTube video tasks.

**Why:** Advertisers want to drive social engagement (follows, likes, comments, reposts). AI verification removes the admin bottleneck for screenshot-based proof.

## AI provider decision

Uses `@google/generative-ai` (npm) directly with user's own `GEMINI_API_KEY` — NOT the Replit AI Integrations proxy. Reason: this is a Vercel-deployed Next.js app with no Replit infrastructure; the user chose Gemini's free tier (~1,500 req/day with personal API key from aistudio.google.com).

**Model:** `gemini-2.0-flash` — supports multimodal (image) input, free tier.

## Confidence thresholds

- ≥ 75 → `approved` (auto-credit, no admin review)
- 36–74 → `uncertain` (goes to manual approvals queue as `pending`)
- ≤ 35 → `rejected` (returned as 422 `AI_REJECTED` — no completion row inserted so user can retry)

**Why no row on rejection:** Keeps the unique constraint clean; user retries with a better screenshot without needing admin to clear a rejected row.

## Files changed

- `supabase/migrations/20260717_social_tasks.sql` — 6 columns on tasks, 3 on task_completions, 2 indexes
- `src/types/index.ts` — SocialPlatform, SocialAction, AiVerdict types; extended Task and TaskCompletion
- `src/lib/ai-vision.ts` — `verifySocialScreenshot(imageUrl, task)` → AiVerdict
- `package.json` — added `@google/generative-ai: ^0.21.0`
- `.env.example` — added GEMINI_API_KEY
- `src/components/tasks/SocialStepGuide.tsx` — new step-by-step UI per platform/action
- `src/components/tasks/TaskCard.tsx` — indigo accent bar + action badge for social tasks
- `src/components/tasks/TaskCompletionModal.tsx` — social variant with step guide, screenshot-only upload, inline AI rejection state
- `src/app/api/tasks/[id]/complete/route.ts` — social branch: proof_url required, optional AI call, early return on rejection
- `src/app/api/admin/tasks/route.ts` + `[id]/route.ts` — social fields added to EDITABLE_TASK_FIELDS whitelist
- `src/app/admin/tasks/page.tsx` — third format button, social settings panel with platform/action/handle/post-URL/comment-text/AI-toggle
- `src/app/admin/approvals/page.tsx` — AI Verdict column with badge + inline reason text
- `src/app/dashboard/tasks/page.tsx` — handleComplete now returns { ok, aiReason } instead of boolean

## How to apply

1. `supabase db push` (or run migration manually) against the Supabase project
2. Add `GEMINI_API_KEY` to Vercel environment variables (server-side only)
3. `npm install` to pick up `@google/generative-ai`
