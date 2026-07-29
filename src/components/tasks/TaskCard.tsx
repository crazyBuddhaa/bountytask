import { useState } from "react"
import { Clock, Zap, Users, ArrowRight, Youtube, Share2, PlayCircle } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { formatCurrency } from "@/lib/utils"
import type { Task } from "@/types"

// ─── Watch & Earn bundle card ─────────────────────────────────────────────────

interface WatchEarnBundleCardProps {
  tasks: Task[]
  onWatch: () => void
}

export function WatchEarnBundleCard({ tasks, onWatch }: WatchEarnBundleCardProps) {
  const count = tasks.length
  const rewardPerVideo = tasks[0]?.reward_amount ?? 0
  const allSame = tasks.every(t => t.reward_amount === rewardPerVideo)

  return (
    <Card className="flex flex-col hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group border-l-4 border-l-red-500">
      <CardContent className="p-5 flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <Badge variant="outline" className="text-[10px] border-red-200 text-red-600 bg-red-50 gap-1">
            <Youtube className="w-2.5 h-2.5" /> Watch &amp; Earn
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1">
            <PlayCircle className="w-2.5 h-2.5" /> {count} video{count !== 1 ? "s" : ""}
          </Badge>
        </div>

        <h3 className="font-semibold text-sm leading-snug mb-2 group-hover:text-primary transition-colors">
          YouTube Watch Tasks
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {count} video{count !== 1 ? "s" : ""} available. Watch each to the end and earn instantly — one reward per video.
        </p>

        <p className="text-[10px] text-red-500 mt-2 font-medium flex items-center gap-1">
          <Youtube className="w-3 h-3" /> Watch the full video to earn instantly
        </p>
      </CardContent>

      <CardFooter className="p-5 pt-0 flex items-center justify-between border-t mt-2">
        <div>
          <p className="text-lg font-bold text-primary">
            {allSame ? formatCurrency(rewardPerVideo) : `up to ${formatCurrency(Math.max(...tasks.map(t => t.reward_amount)))}`}
            <span className="text-xs font-normal text-muted-foreground ml-1">/ video</span>
          </p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Zap className="w-2.5 h-2.5 text-primary" /> Instant pay · {count} video{count !== 1 ? "s" : ""} in queue
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onWatch}
          className="gap-1 border-red-200 text-red-600 hover:bg-red-50">
          <Youtube className="w-3 h-3" /> Watch
        </Button>
      </CardFooter>
    </Card>
  )
}

// ─── Social bundle card ───────────────────────────────────────────────────────

interface SocialBundleCardProps {
  tasks: Task[]
  onSelect: (task: Task) => void
}

const PLATFORM_EMOJI: Record<string, string> = {
  twitter_x: "𝕏",
  instagram:  "📸",
  tiktok:     "🎵",
  youtube:    "▶",
  facebook:   "f",
  threads:    "@",
}

const PLATFORM_LABELS_BUNDLE: Record<string, string> = {
  twitter_x: "Twitter/X",
  instagram:  "Instagram",
  tiktok:     "TikTok",
  youtube:    "YouTube",
  facebook:   "Facebook",
  threads:    "Threads",
}

const ACTION_LABELS_BUNDLE: Record<string, string> = {
  follow: "Follow", like: "Like", comment: "Comment",
  repost: "Repost", subscribe: "Subscribe",
}

const PLATFORM_BORDER_BUNDLE: Record<string, string> = {
  twitter_x: "border-l-gray-900",
  instagram:  "border-l-pink-500",
  tiktok:     "border-l-cyan-400",
  youtube:    "border-l-red-600",
  facebook:   "border-l-blue-600",
  threads:    "border-l-gray-700",
}

export function SocialBundleCard({ tasks, onSelect }: SocialBundleCardProps) {
  const [open, setOpen] = useState(false)
  const count = tasks.length
  const maxReward = Math.max(...tasks.map(t => t.reward_amount))
  const minReward = Math.min(...tasks.map(t => t.reward_amount))
  const allSameReward = minReward === maxReward

  // Unique platforms for preview chips
  const uniquePlatforms = [...new Set(tasks.map(t => t.social_platform).filter(Boolean))] as string[]

  return (
    <>
      <Card className="flex flex-col hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group border-l-4 border-l-indigo-500">
        <CardContent className="p-5 flex-1">
          <div className="flex items-start justify-between gap-2 mb-3">
            <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-600 bg-indigo-50 gap-1">
              <Share2 className="w-2.5 h-2.5" /> Social Tasks
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1">
              {count} task{count !== 1 ? "s" : ""}
            </Badge>
          </div>

          <h3 className="font-semibold text-sm leading-snug mb-2 group-hover:text-primary transition-colors">
            Social Media Tasks
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2">
            Follow, like, comment, repost and more across{" "}
            {uniquePlatforms.slice(0, 3).map(p => PLATFORM_LABELS_BUNDLE[p] ?? p).join(", ")}
            {uniquePlatforms.length > 3 ? " and more" : ""}.
          </p>

          {uniquePlatforms.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {uniquePlatforms.slice(0, 4).map(p => (
                <span key={p} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                  {PLATFORM_EMOJI[p] ?? ""} {PLATFORM_LABELS_BUNDLE[p] ?? p}
                </span>
              ))}
              {uniquePlatforms.length > 4 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  +{uniquePlatforms.length - 4} more
                </span>
              )}
            </div>
          )}

          <p className="text-[10px] text-indigo-600 mt-2 font-medium flex items-center gap-1">
            <Share2 className="w-3 h-3" /> Screenshot required for all tasks
          </p>
        </CardContent>

        <CardFooter className="p-5 pt-0 flex items-center justify-between border-t mt-2">
          <div>
            <p className="text-lg font-bold text-primary">
              {allSameReward
                ? formatCurrency(maxReward)
                : `${formatCurrency(minReward)} – ${formatCurrency(maxReward)}`}
            </p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Users className="w-2.5 h-2.5" /> {count} task{count !== 1 ? "s" : ""} available
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen(true)}
            className="gap-1 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            <Share2 className="w-3 h-3" /> Browse
          </Button>
        </CardFooter>
      </Card>

      {/* ── Social task picker sheet ─────────────────────────────────────────── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[82vh] overflow-y-auto rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Share2 className="w-4 h-4 text-indigo-500" /> Social Tasks
            </SheetTitle>
            <p className="text-xs text-muted-foreground">
              {count} task{count !== 1 ? "s" : ""} available — pick one to start
            </p>
          </SheetHeader>

          <div className="space-y-3">
            {tasks.map(task => {
              const spotsLeft = task.max_completions !== null
                ? task.max_completions - task.current_completions
                : null
              const borderClass = PLATFORM_BORDER_BUNDLE[task.social_platform ?? ""] ?? "border-l-indigo-500"
              return (
                <div
                  key={task.id}
                  className={`rounded-lg border border-l-4 ${borderClass} bg-card p-4 cursor-pointer hover:shadow-sm active:scale-[0.99] transition-all`}
                  onClick={() => { setOpen(false); onSelect(task) }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 font-medium">
                          {ACTION_LABELS_BUNDLE[task.social_action!] ?? task.social_action}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          {PLATFORM_EMOJI[task.social_platform ?? ""] ?? ""} {PLATFORM_LABELS_BUNDLE[task.social_platform!] ?? task.social_platform}
                        </span>
                        {task.ai_verify_screenshot && (
                          <span className="text-[10px] text-indigo-500 font-medium">AI verified</span>
                        )}
                      </div>
                      <p className="font-semibold text-sm leading-snug line-clamp-2">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                      )}
                      {spotsLeft !== null && (
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Users className="w-2.5 h-2.5" /> {spotsLeft.toLocaleString()} spots left
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold text-primary text-base">{formatCurrency(task.reward_amount)}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1.5 h-7 text-xs gap-1 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                        onClick={e => { e.stopPropagation(); setOpen(false); onSelect(task) }}
                      >
                        <Share2 className="w-3 h-3" /> Start
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

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
