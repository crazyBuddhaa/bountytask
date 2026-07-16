"use client"
import { ExternalLink, Copy, CheckCircle2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { Task } from "@/types"

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { label: string; emoji: string; accentClass: string }> = {
  twitter_x:  { label: "Twitter/X",  emoji: "𝕏",  accentClass: "bg-black text-white" },
  instagram:  { label: "Instagram",  emoji: "📸", accentClass: "bg-gradient-to-r from-purple-600 to-pink-500 text-white" },
  tiktok:     { label: "TikTok",     emoji: "🎵", accentClass: "bg-black text-white" },
  youtube:    { label: "YouTube",    emoji: "▶",  accentClass: "bg-red-600 text-white" },
  facebook:   { label: "Facebook",   emoji: "f",  accentClass: "bg-blue-600 text-white" },
  threads:    { label: "Threads",    emoji: "@",  accentClass: "bg-gray-900 text-white" },
}

const ACTION_LABELS: Record<string, string> = {
  follow:    "Follow",
  like:      "Like",
  comment:   "Comment",
  repost:    "Repost",
  subscribe: "Subscribe",
}

// ─── URL builder ─────────────────────────────────────────────────────────────

function buildPlatformUrl(task: Task): string {
  const raw = task.social_target_handle ?? ""
  const handle = raw.replace(/^@/, "")

  if (task.social_action === "follow" || task.social_action === "subscribe") {
    switch (task.social_platform) {
      case "twitter_x":  return `https://twitter.com/${handle}`
      case "instagram":  return `https://www.instagram.com/${handle}/`
      case "tiktok":     return `https://www.tiktok.com/@${handle}`
      case "youtube":    return `https://www.youtube.com/@${handle}`
      case "facebook":   return `https://www.facebook.com/${handle}`
      case "threads":    return `https://www.threads.net/@${handle}`
    }
  }

  return task.social_target_post_url ?? ""
}

// ─── Step content ─────────────────────────────────────────────────────────────

function getStep2(task: Task): { heading: string; note: string } {
  const h = task.social_target_handle ?? "the account"

  switch (task.social_action) {
    case "follow":
      return {
        heading: `Tap the Follow button on ${h}'s profile`,
        note: `Wait until the button changes to "Following" before taking your screenshot.`,
      }
    case "subscribe":
      return {
        heading: `Click Subscribe on the ${h} channel`,
        note: `Wait until the button reads "Subscribed" before taking your screenshot.`,
      }
    case "like":
      return {
        heading: "Tap the Like or Heart button on the post",
        note: "The icon should turn filled / coloured to confirm your like was registered.",
      }
    case "repost":
      return {
        heading: "Tap Repost / Retweet on the post",
        note: `Confirm the repost indicator shows as active (highlighted icon or counter) before screenshotting.`,
      }
    case "comment":
      return {
        heading: "Type and post your comment",
        note: task.social_required_comment_text
          ? `Your comment must contain the exact text shown below. Copy it carefully.`
          : "Post your comment and make sure it's visible in the thread.",
      }
    default:
      return { heading: "Complete the required action", note: "Make sure the action is clearly visible." }
  }
}

function getScreenshotRules(task: Task): string[] {
  const h = task.social_target_handle ?? "the account"

  switch (task.social_action) {
    case "follow":
      return [
        `The profile for ${h} is visible`,
        `The Follow button reads "Following" (not "Follow")`,
      ]
    case "subscribe":
      return [
        `The channel for ${h} is visible`,
        `The Subscribe button reads "Subscribed"`,
      ]
    case "like":
      return [
        "The like / heart icon is in its filled or active state",
        "The post content is identifiable",
      ]
    case "repost":
      return [
        "The repost / retweet indicator is active",
        "The original post is visible",
      ]
    case "comment":
      return [
        "Your comment is posted and visible in the thread",
        ...(task.social_required_comment_text
          ? [`Your comment contains: "${task.social_required_comment_text}"`]
          : ["Your username or avatar is visible next to the comment"]),
      ]
    default:
      return ["The completed action is clearly visible"]
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SocialStepGuideProps {
  task: Task
}

export function SocialStepGuide({ task }: SocialStepGuideProps) {
  const [copied, setCopied] = useState(false)

  const platform = task.social_platform!
  const config = PLATFORM_CONFIG[platform] ?? { label: platform, emoji: "🌐", accentClass: "bg-gray-700 text-white" }
  const actionLabel = ACTION_LABELS[task.social_action!] ?? task.social_action
  const step2 = getStep2(task)
  const screenshotRules = getScreenshotRules(task)
  const goToUrl = buildPlatformUrl(task)

  async function handleCopy() {
    if (!task.social_required_comment_text) return
    await navigator.clipboard.writeText(task.social_required_comment_text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      {/* Step 1 — Open the platform */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          Step 1 — Open the link
        </p>
        <p className="text-sm text-foreground mb-2">
          Go to{" "}
          <span className="font-semibold">
            {task.social_action === "follow" || task.social_action === "subscribe"
              ? `${task.social_target_handle}'s profile on ${config.label}`
              : `the post on ${config.label}`}
          </span>
        </p>
        {goToUrl && (
          <a
            href={goToUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Open on {config.label}
          </a>
        )}
      </div>

      {/* Step 2 — Perform action */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          Step 2 — {actionLabel}
        </p>
        <p className="text-sm text-foreground">{step2.heading}</p>
        <p className="text-xs text-muted-foreground mt-1">{step2.note}</p>

        {/* Required comment text */}
        {task.social_action === "comment" && task.social_required_comment_text && (
          <div className="mt-2.5 rounded-md border border-amber-200 bg-amber-50 p-2.5">
            <p className="text-xs font-semibold text-amber-700 mb-1">Required comment text</p>
            <p className="text-sm font-mono text-amber-900 leading-snug">
              "{task.social_required_comment_text}"
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={handleCopy}
            >
              {copied ? (
                <><CheckCircle2 className="w-3 h-3" /> Copied!</>
              ) : (
                <><Copy className="w-3 h-3" /> Copy text</>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Step 3 — Screenshot rules */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          Step 3 — Take a screenshot
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          Your screenshot must clearly show all of the following:
        </p>
        <ul className="space-y-1">
          {screenshotRules.map((rule, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
              <span className="mt-0.5 text-emerald-500 shrink-0">✓</span>
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
