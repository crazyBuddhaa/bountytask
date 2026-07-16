"use client"
import { useState } from "react"
import { Loader2, Upload, ExternalLink, XCircle, Share2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { uploadTaskProof } from "@/lib/storage"
import { SocialStepGuide } from "@/components/tasks/SocialStepGuide"
import type { Task } from "@/types"

// ─── Platform display config ──────────────────────────────────────────────────
const PLATFORM_LABELS: Record<string, string> = {
  twitter_x: "Twitter/X", instagram: "Instagram", tiktok: "TikTok",
  youtube: "YouTube", facebook: "Facebook", threads: "Threads",
}

const ACTION_LABELS: Record<string, string> = {
  follow: "Follow", like: "Like", comment: "Comment",
  repost: "Repost", subscribe: "Subscribe",
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskCompletionModalProps {
  task: Task
  onClose: () => void
  /** Returns { ok: true } on success, or { ok: false, aiReason } on AI rejection */
  onSubmit: (proof?: { url?: string; text?: string }) => Promise<{ ok: boolean; aiReason?: string }>
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskCompletionModal({ task, onClose, onSubmit }: TaskCompletionModalProps) {
  const [proofText, setProofText]               = useState("")
  const [proofFile, setProofFile]               = useState<File | null>(null)
  const [uploading, setUploading]               = useState(false)
  const [submitting, setSubmitting]             = useState(false)
  const [aiRejectionReason, setAiRejectionReason] = useState<string | null>(null)

  const isSocial  = !!task.social_platform
  const isAiTask  = !!task.ai_verify_screenshot

  async function handleSubmit() {
    setSubmitting(true)
    let proofUrl: string | undefined

    if (proofFile) {
      setUploading(true)
      try {
        proofUrl = await uploadTaskProof(proofFile, task.id)
      } catch {
        setUploading(false)
        setSubmitting(false)
        return
      }
      setUploading(false)
    }

    const result = await onSubmit({ url: proofUrl, text: proofText || undefined })

    if (result.ok) {
      onClose()
    } else if (result.aiReason) {
      // AI rejected — show inline rejection state, don't close
      setAiRejectionReason(result.aiReason)
      setProofFile(null) // reset upload so user can try again
    }
    // Other failures (network, validation) are handled by toast in the parent
    setSubmitting(false)
  }

  function handleRetry() {
    setAiRejectionReason(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg leading-snug">{task.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            Reward: <span className="font-bold text-primary">{formatCurrency(task.reward_amount)}</span>
            {isSocial ? (
              <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-600 bg-indigo-50 gap-1">
                <Share2 className="w-2.5 h-2.5" />
                {ACTION_LABELS[task.social_action!] ?? task.social_action} · {PLATFORM_LABELS[task.social_platform!] ?? task.social_platform}
              </Badge>
            ) : (
              <Badge variant={task.type === "unverified" ? "success" : "pending"} className="text-[10px]">
                {task.type === "unverified" ? "Instant Pay" : "Verified"}
              </Badge>
            )}
            {isAiTask && (
              <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-600 bg-indigo-50">
                AI-Verified
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Social task variant ─────────────────────────────────────────── */}
          {isSocial ? (
            <>
              {/* Step guide */}
              <SocialStepGuide task={task} />

              {/* Upload zone OR AI rejection state */}
              {aiRejectionReason ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                  <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" /> Screenshot not accepted
                  </p>
                  <p className="text-sm text-muted-foreground leading-snug">{aiRejectionReason}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive/5 mt-1"
                    onClick={handleRetry}
                  >
                    Upload a different screenshot
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>
                    Upload screenshot{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
                    <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {proofFile ? proofFile.name : "Click or drag screenshot here"}
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">JPG, PNG — max 5 MB</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={e => setProofFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              )}

              {/* AI / manual review notice */}
              {!aiRejectionReason && (
                task.ai_verify_screenshot ? (
                  <div className="flex items-start gap-2 rounded-lg bg-indigo-50 border border-indigo-100 p-3">
                    <span className="text-indigo-500 text-sm mt-0.5 shrink-0">ℹ</span>
                    <p className="text-xs text-indigo-700">
                      Your screenshot will be checked automatically by AI. Results are usually instant.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 p-3">
                    <span className="text-amber-500 text-sm mt-0.5 shrink-0">ℹ</span>
                    <p className="text-xs text-amber-700">
                      Your screenshot will be reviewed by our team within 24 hours. You'll get a notification when it's approved.
                    </p>
                  </div>
                )
              )}
            </>
          ) : isAiTask && task.requires_proof ? (
            /* ── Standard task with AI screenshot verification ──────────────── */
            <>
              {/* Instructions */}
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Instructions</p>
                <p className="text-sm whitespace-pre-line">{task.instructions}</p>
                {task.verification_url && (
                  <a href={task.verification_url} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="w-3 h-3" />Visit task link
                  </a>
                )}
              </div>

              {/* Upload zone OR AI rejection state */}
              {aiRejectionReason ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                  <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" /> Screenshot not accepted
                  </p>
                  <p className="text-sm text-muted-foreground leading-snug">{aiRejectionReason}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive/5 mt-1"
                    onClick={handleRetry}
                  >
                    Upload a different screenshot
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>
                    Upload screenshot{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  {task.proof_instructions && (
                    <p className="text-xs text-muted-foreground">{task.proof_instructions}</p>
                  )}
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                    <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {proofFile ? proofFile.name : "Click or drag screenshot here"}
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">JPG, PNG — max 5 MB</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={e => setProofFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              )}

              {/* AI review notice */}
              {!aiRejectionReason && (
                <div className="flex items-start gap-2 rounded-lg bg-indigo-50 border border-indigo-100 p-3">
                  <span className="text-indigo-500 text-sm mt-0.5 shrink-0">ℹ</span>
                  <p className="text-xs text-indigo-700">
                    Your screenshot will be checked automatically by AI. Results are usually instant.
                  </p>
                </div>
              )}
            </>
          ) : (
            /* ── Standard task (manual proof / no proof) ────────────────────── */
            <>
              {/* Instructions */}
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Instructions</p>
                <p className="text-sm whitespace-pre-line">{task.instructions}</p>
                {task.verification_url && (
                  <a href={task.verification_url} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="w-3 h-3" />Visit task link
                  </a>
                )}
              </div>

              {/* Proof section */}
              {task.requires_proof && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Proof Required</p>
                  {task.proof_instructions && (
                    <p className="text-xs text-muted-foreground">{task.proof_instructions}</p>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="proof_text">Description / Link</Label>
                    <Textarea
                      id="proof_text"
                      placeholder="Describe your completion or paste a screenshot link..."
                      value={proofText}
                      onChange={e => setProofText(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Upload File (optional)</Label>
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
                      <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">
                        {proofFile ? proofFile.name : "Click to upload screenshot"}
                      </span>
                      <input type="file" className="hidden" accept="image/*,video/mp4,application/pdf"
                        onChange={e => setProofFile(e.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Action buttons ──────────────────────────────────────────────── */}
          {!aiRejectionReason && (
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
              <Button
                variant="gradient"
                onClick={handleSubmit}
                disabled={
                  submitting || uploading ||
                  ((isSocial || (isAiTask && task.requires_proof)) && !proofFile)
                }
                className="flex-1"
              >
                {(submitting || uploading) && <Loader2 className="animate-spin" />}
                {uploading ? "Uploading…" : submitting ? "Submitting…" : "Submit Completion"}
              </Button>
            </div>
          )}
          {aiRejectionReason && (
            <Button variant="outline" onClick={onClose} className="w-full">Close</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
