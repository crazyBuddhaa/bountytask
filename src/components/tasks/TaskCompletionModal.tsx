"use client"
import { useState } from "react"
import { Loader2, Upload, ExternalLink } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { uploadTaskProof } from "@/lib/storage"
import type { Task } from "@/types"

interface TaskCompletionModalProps {
  task: Task
  onClose: () => void
  onSubmit: (proof?: { url?: string; text?: string }) => Promise<boolean>
}

export function TaskCompletionModal({ task, onClose, onSubmit }: TaskCompletionModalProps) {
  const [proofText, setProofText] = useState("")
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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

    const ok = await onSubmit({ url: proofUrl, text: proofText || undefined })
    if (ok) onClose()
    setSubmitting(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">{task.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            Reward: <span className="font-bold text-primary">{formatCurrency(task.reward_amount)}</span>
            <Badge variant={task.type === "unverified" ? "success" : "pending"} className="text-[10px]">
              {task.type === "unverified" ? "Instant Pay" : "Verified"}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button variant="gradient" onClick={handleSubmit} disabled={submitting || uploading} className="flex-1">
              {(submitting || uploading) && <Loader2 className="animate-spin" />}
              {uploading ? "Uploading..." : submitting ? "Submitting..." : "Submit Completion"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
