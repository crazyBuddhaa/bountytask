import { Clock, Zap, Users, ArrowRight, Youtube, Share2 } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import type { Task } from "@/types"

// ─── Social platform accent colours ──────────────────────────────────────────
const PLATFORM_BORDER: Record<string, string> = {
  twitter_x: "border-l-gray-900",
  instagram:  "border-l-pink-500",
  tiktok:     "border-l-cyan-400",
  youtube:    "border-l-red-600",
  facebook:   "border-l-blue-600",
  threads:    "border-l-gray-700",
}

const PLATFORM_LABELS: Record<string, string> = {
  twitter_x: "Twitter/X",
  instagram:  "Instagram",
  tiktok:     "TikTok",
  youtube:    "YouTube",
  facebook:   "Facebook",
  threads:    "Threads",
}

const ACTION_LABELS: Record<string, string> = {
  follow:    "Follow",
  like:      "Like",
  comment:   "Comment",
  repost:    "Repost",
  subscribe: "Subscribe",
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task
  onClaim: () => void
  onWatch?: () => void
}

export function TaskCard({ task, onClaim, onWatch }: TaskCardProps) {
  const spotsLeft = task.max_completions !== null
    ? task.max_completions - task.current_completions
    : null

  const isInstant = task.type === "unverified"
  const isVideo   = !!task.youtube_url
  const isSocial  = !!task.social_platform

  const platformBorder = isSocial
    ? `border-l-4 ${PLATFORM_BORDER[task.social_platform!] ?? "border-l-indigo-500"}`
    : ""

  return (
    <Card className={`flex flex-col hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group ${platformBorder}`}>
      <CardContent className="p-5 flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          {/* ── Badge row ── */}
          {isSocial ? (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-600 bg-indigo-50 gap-1">
                <Share2 className="w-2.5 h-2.5" />
                {ACTION_LABELS[task.social_action!] ?? task.social_action}
              </Badge>
              <span className="text-[10px] text-muted-foreground font-medium">
                {PLATFORM_LABELS[task.social_platform!] ?? task.social_platform}
              </span>
            </div>
          ) : isVideo ? (
            <Badge variant="outline" className="text-[10px] border-red-200 text-red-600 bg-red-50 gap-1">
              <Youtube className="w-2.5 h-2.5" /> Watch &amp; Earn
            </Badge>
          ) : (
            <Badge variant={isInstant ? "success" : "pending"} className="text-[10px]">
              {isInstant
                ? <><Zap className="w-2.5 h-2.5" />Instant</>
                : <><Clock className="w-2.5 h-2.5" />Verified</>}
            </Badge>
          )}

          {task.category && (
            <span className="text-xs text-muted-foreground">
              {task.category.icon ?? "🎯"} {task.category.name}
            </span>
          )}
        </div>

        <h3 className="font-semibold text-sm leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {task.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>

        {/* ── Footer hints ── */}
        {isSocial && (
          <p className="text-[10px] text-indigo-600 mt-2 font-medium flex items-center gap-1">
            <Share2 className="w-3 h-3" />
            {task.ai_verify_screenshot ? "AI-verified screenshot required" : "Screenshot required · Manual review"}
          </p>
        )}
        {!isSocial && !isVideo && task.requires_proof && (
          <p className="text-[10px] mt-2 font-medium flex items-center gap-1"
            style={{ color: task.ai_verify_screenshot ? "rgb(79 70 229)" : "rgb(217 119 6)" }}>
            {task.ai_verify_screenshot
              ? <><Share2 className="w-3 h-3" />AI-verified screenshot required</>
              : <>⚠ Proof of completion required</>}
          </p>
        )}
        {isVideo && (
          <p className="text-[10px] text-red-500 mt-2 font-medium flex items-center gap-1">
            <Youtube className="w-3 h-3" /> Watch the full video to earn instantly
          </p>
        )}
      </CardContent>

      <CardFooter className="p-5 pt-0 flex items-center justify-between border-t mt-2">
        <div>
          <p className="text-lg font-bold text-primary">{formatCurrency(task.reward_amount)}</p>
          {spotsLeft !== null && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Users className="w-2.5 h-2.5" />{spotsLeft.toLocaleString()} spots left
            </p>
          )}
        </div>

        {isVideo ? (
          <Button size="sm" variant="outline" onClick={onWatch ?? onClaim}
            className="gap-1 border-red-200 text-red-600 hover:bg-red-50">
            <Youtube className="w-3 h-3" /> Watch
          </Button>
        ) : isSocial ? (
          <Button size="sm" variant="outline" onClick={onClaim}
            className="gap-1 border-indigo-200 text-indigo-600 hover:bg-indigo-50">
            <Share2 className="w-3 h-3" /> Start
          </Button>
        ) : (
          <Button size="sm" variant="gradient" onClick={onClaim} className="gap-1">
            Claim <ArrowRight className="w-3 h-3" />
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
