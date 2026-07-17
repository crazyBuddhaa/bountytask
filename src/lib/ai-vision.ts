import { GoogleGenerativeAI } from "@google/generative-ai"
import type { Task } from "@/types"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
})

export interface AiVerdict {
  verdict: "approved" | "rejected" | "uncertain"
  confidence: number
  reason: string
}

const PLATFORM_LABELS: Record<string, string> = {
  twitter_x: "Twitter/X",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  threads: "Threads",
}

const ACTION_LABELS: Record<string, string> = {
  follow: "follow",
  like: "like",
  comment: "comment",
  repost: "repost/retweet",
  subscribe: "subscribe",
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildSocialCriteria(task: Task): string {
  const handle = task.social_target_handle ?? "the specified account"

  switch (task.social_action) {
    case "follow":
      return `The screenshot must clearly show:
- The profile page of ${handle} on ${PLATFORM_LABELS[task.social_platform!] ?? task.social_platform}
- The follow/following button in its ACTIVE state (reads "Following", "Unfollow", or equivalent — NOT "Follow")
- The account handle or display name must be legible`

    case "subscribe":
      return `The screenshot must clearly show:
- The channel or page for ${handle} on ${PLATFORM_LABELS[task.social_platform!] ?? task.social_platform}
- The subscribe button in its ACTIVE state (reads "Subscribed", "Unsubscribe", or similar — NOT "Subscribe")
- The channel name must be legible`

    case "like":
      return `The screenshot must clearly show:
- A post or video on ${PLATFORM_LABELS[task.social_platform!] ?? task.social_platform}${task.social_target_post_url ? ` (post URL: ${task.social_target_post_url})` : ""}
- The like/heart/thumbs-up button in its ACTIVE/FILLED state (coloured, not outline)
- The post content or URL must be identifiable`

    case "repost":
      return `The screenshot must clearly show:
- A post on ${PLATFORM_LABELS[task.social_platform!] ?? task.social_platform}${task.social_target_post_url ? ` (post URL: ${task.social_target_post_url})` : ""}
- The repost/retweet/share indicator in its ACTIVE state (icon highlighted, count incremented, or "Retweeted by you" label visible)
- The original post content must be identifiable`

    case "comment": {
      const requiredText = task.social_required_comment_text
      return `The screenshot must clearly show:
- A comment thread on ${PLATFORM_LABELS[task.social_platform!] ?? task.social_platform}${task.social_target_post_url ? ` (post URL: ${task.social_target_post_url})` : ""}
- A comment posted by the user${requiredText ? ` containing the EXACT text: "${requiredText}"` : ""}
- The user's username or avatar must be visible next to the comment
${requiredText ? `- IMPORTANT: The comment must contain the exact required text. Partial matches or paraphrases are NOT acceptable.` : ""}`
    }

    default:
      return "The screenshot must clearly prove the social media action was completed as described."
  }
}

function buildSocialPrompt(task: Task): string {
  const platform = PLATFORM_LABELS[task.social_platform!] ?? task.social_platform
  const action = ACTION_LABELS[task.social_action!] ?? task.social_action

  return `You are a screenshot verifier for a task rewards platform. A user has submitted a screenshot as proof of completing a social media task. Your job is to determine whether the screenshot genuinely proves the required action was completed.

TASK DETAILS:
- Platform: ${platform}
- Required action: ${action}
- Target account/handle: ${task.social_target_handle ?? "N/A"}${task.social_target_post_url ? `\n- Post/video URL: ${task.social_target_post_url}` : ""}

VERIFICATION CRITERIA:
${buildSocialCriteria(task)}

IMPORTANT RULES:
- Be strict. If any required element is unclear, cropped out, or ambiguous, do NOT approve.
- Watch for obvious editing (mismatched fonts, inconsistent UI elements, unrealistic numbers).
- A screenshot of search results or a profile that does NOT show the completed action state is NOT sufficient.
- A screenshot showing the WRONG account or post must be rejected.

${VERDICT_FORMAT}`
}

function buildGenericPrompt(task: Task): string {
  return `You are a screenshot verifier for a task rewards platform. A user claims to have completed a task and submitted a screenshot as proof. Determine whether the screenshot genuinely proves the task was completed.

TASK DETAILS:
- Title: ${task.title}
- Description: ${task.description}
- Instructions to complete: ${task.instructions}${task.verification_url ? `\n- Task URL: ${task.verification_url}` : ""}

VERIFICATION CRITERIA:
The screenshot must clearly show evidence that the user completed the task as described. Look for:
- Visible confirmation of the action or outcome described in the task
- Relevant UI elements, usernames, timestamps, content, or confirmation messages matching the task requirements
- The screenshot must be authentic — watch for editing artifacts, mismatched UI, or implausible results

IMPORTANT RULES:
- Be strict. If the screenshot is unrelated, blurred, or does not clearly prove completion, do NOT approve.
- A screenshot that could have been taken before the task was done is NOT sufficient.
- Watch for obvious editing (mismatched fonts, inconsistent UI, fabricated confirmation text).

${VERDICT_FORMAT}`
}

const VERDICT_FORMAT = `Respond with ONLY valid JSON (no markdown, no explanation outside the JSON):
{
  "verdict": "approved" | "rejected" | "uncertain",
  "confidence": <integer from 0 to 100>,
  "reason": "<one clear sentence explaining your decision>"
}

Verdict guide:
- "approved" — screenshot unambiguously proves the action is completed (use confidence 75–100)
- "uncertain" — screenshot shows partial evidence but something is unclear, cropped, or hard to confirm (use confidence 36–74)
- "rejected" — screenshot does not prove the action, appears edited, or is unrelated (use confidence 0–35)`

// ─── Core verification engine ─────────────────────────────────────────────────

async function verifyWithPrompt(imageUrl: string, prompt: string): Promise<AiVerdict> {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set — AI verify falling back to manual review")
    return {
      verdict: "uncertain",
      confidence: 0,
      reason: "AI verification is not configured. Your submission has been queued for manual review.",
    }
  }

  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) })
    if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`)

    const buffer = await imgRes.arrayBuffer()
    const b64 = Buffer.from(buffer).toString("base64")
    const mimeType = (imgRes.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim()

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: b64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 256,
        temperature: 0.1,
      },
    })

    const text = result.response.text().trim()
    const parsed = JSON.parse(text) as { verdict: string; confidence: number; reason: string }

    // Enforce confidence → verdict mapping regardless of what the model said
    const confidence = Math.max(0, Math.min(100, Math.round(parsed.confidence ?? 50)))
    let verdict: AiVerdict["verdict"]
    if (confidence >= 75) verdict = "approved"
    else if (confidence <= 35) verdict = "rejected"
    else verdict = "uncertain"

    return {
      verdict,
      confidence,
      reason: String(parsed.reason ?? "No reason provided.").slice(0, 500),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("AI vision error:", msg)
    return {
      verdict: "uncertain",
      confidence: 0,
      reason: `AI verification failed (${msg.slice(0, 120)}). Your submission has been queued for manual review.`,
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Verifies a task completion screenshot using Gemini Vision.
 * Automatically uses a social-specific prompt for social tasks and a
 * generic prompt for all other task types.
 * On any error returns "uncertain" so the submission falls to manual review.
 */
export async function verifyScreenshot(imageUrl: string, task: Task): Promise<AiVerdict> {
  const prompt = task.social_platform
    ? buildSocialPrompt(task)
    : buildGenericPrompt(task)
  return verifyWithPrompt(imageUrl, prompt)
}

/** @deprecated Use verifyScreenshot() — kept for import compatibility */
export const verifySocialScreenshot = verifyScreenshot
