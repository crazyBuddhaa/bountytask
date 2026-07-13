"use client"
/**
 * IMA SDK rewarded video player.
 *
 * Flow:
 * 1. User clicks "Watch Ad" → POST /api/ad-tasks/ima/start → { token, adTagUrl }
 * 2. IMA SDK loads the ad, video plays in the ad container
 * 3. On AD_COMPLETE event → POST /api/ad-tasks/ima/complete with token
 * 4. User sees credit confirmation
 *
 * The token is signed server-side with a 10-min TTL — prevents replay attacks
 * and ensures credits only happen after real ad completion events.
 */
import { useRef, useState, useCallback } from "react"
import Script from "next/script"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PlayCircle, CheckCircle2, Loader2, AlertCircle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any

type Phase =
  | "idle"        // ready to start
  | "starting"    // fetching token from server
  | "loading-ad"  // IMA SDK requesting the ad
  | "playing"     // ad is playing
  | "crediting"   // ad done, calling /complete
  | "done"        // credited
  | "error"       // something went wrong

interface Props {
  initialCap: { used: number; cap: number }
  rewardKobo: number
}

export default function WatchAdClient({ initialCap, rewardKobo }: Props) {
  const [phase, setPhase]         = useState<Phase>("idle")
  const [errorMsg, setErrorMsg]   = useState("")
  const [cap, setCap]             = useState(initialCap)
  const [creditedKobo, setCreditedKobo] = useState(0)

  const adContainerRef = useRef<HTMLDivElement>(null)
  const contentVideoRef = useRef<HTMLVideoElement>(null)
  const imaReady = useRef(false)

  const setError = (msg: string) => { setPhase("error"); setErrorMsg(msg) }

  const handleWatch = useCallback(async () => {
    if (!imaReady.current) { setError("Video ad SDK not yet loaded. Please refresh."); return }
    if (cap.used >= cap.cap) return

    setPhase("starting")
    setErrorMsg("")

    // 1. Get one-time token + ad tag URL from our server
    const startRes = await fetch("/api/ad-tasks/ima/start", { method: "POST" })
    const startJson = await startRes.json()

    if (!startRes.ok) {
      setError(startJson.error ?? "Could not start ad session. Try again.")
      return
    }

    const { token, adTagUrl } = startJson as { token: string; adTagUrl: string }

    setPhase("loading-ad")

    try {
      // 2. Initialise IMA
      const container = adContainerRef.current!
      const content   = contentVideoRef.current!

      const adDisplayContainer = new google.ima.AdDisplayContainer(container, content)
      adDisplayContainer.initialize()

      const adsLoader = new google.ima.AdsLoader(adDisplayContainer)

      adsLoader.addEventListener(
        google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (event: any) => {
          const adsManager = event.getAdsManager(content)

          adsManager.addEventListener(
            google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
            async () => {
              setPhase("crediting")
              adsManager.destroy()

              // 3. Credit the user server-side with the token
              const completeRes = await fetch("/api/ad-tasks/ima/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
              })
              const completeJson = await completeRes.json()

              if (!completeRes.ok) {
                setError(completeJson.error ?? "Ad completed but could not credit. Please contact support.")
                return
              }

              setCreditedKobo(completeJson.rewardKobo ?? rewardKobo)
              setCap((prev) => ({ ...prev, used: prev.used + 1 }))
              setPhase("done")
            }
          )

          adsManager.addEventListener(
            google.ima.AdErrorEvent.Type.AD_ERROR,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (adErrorEvent: any) => {
              adsManager.destroy()
              setError(`Ad error: ${adErrorEvent.getError().getMessage()}`)
            }
          )

          try {
            adsManager.init(640, 360, google.ima.ViewMode.NORMAL)
            adsManager.start()
            setPhase("playing")
          } catch {
            setError("Failed to start ad. Please try again.")
          }
        }
      )

      adsLoader.addEventListener(
        google.ima.AdErrorEvent.Type.AD_ERROR,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (adErrorEvent: any) => {
          setError(`Could not load ad: ${adErrorEvent.getError().getMessage()}`)
        }
      )

      const adsRequest = new google.ima.AdsRequest()
      adsRequest.adTagUrl = adTagUrl
      adsRequest.linearAdSlotWidth  = 640
      adsRequest.linearAdSlotHeight = 360
      adsRequest.nonLinearAdSlotWidth  = 640
      adsRequest.nonLinearAdSlotHeight = 150
      adsLoader.requestAds(adsRequest)
    } catch (err) {
      setError(`Unexpected error: ${err instanceof Error ? err.message : "Unknown"}`)
    }
  }, [cap, rewardKobo])

  const capHit = cap.used >= cap.cap

  return (
    <>
      <Script
        src="https://imasdk.googleapis.com/js/sdkloader/ima3.js"
        onReady={() => { imaReady.current = true }}
        onError={() => setError("Could not load the video ad SDK. Check your connection or disable any ad blockers.")}
        strategy="afterInteractive"
      />

      {/* Hidden content video (required by IMA SDK as the content placeholder) */}
      <video ref={contentVideoRef} className="hidden" playsInline />

      {/* IMA ad container */}
      <div
        ref={adContainerRef}
        className="w-full aspect-video rounded-xl overflow-hidden bg-black"
        style={{ display: phase === "playing" || phase === "loading-ad" ? "block" : "none" }}
      />

      {phase === "done" ? (
        <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <div>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                +{formatCurrency(creditedKobo)} earned!
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Your balance has been updated.
                {cap.used < cap.cap && " Watch another ad below."}
              </p>
            </div>
            {cap.used < cap.cap && (
              <Button onClick={handleWatch} disabled={phase !== "done"}>
                <PlayCircle className="w-4 h-4" /> Watch Another Ad
              </Button>
            )}
          </CardContent>
        </Card>
      ) : phase === "error" ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={() => setPhase("idle")}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      ) : phase === "idle" ? (
        <Card>
          <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
            <PlayCircle className="w-14 h-14 text-primary/30" />
            <div>
              <p className="font-medium text-lg">Ready to earn {formatCurrency(rewardKobo)}?</p>
              <p className="text-sm text-muted-foreground mt-1">
                Watch a short video ad from start to finish. Do not close or skip.
              </p>
            </div>
            {capHit ? (
              <p className="text-sm text-muted-foreground border rounded-lg p-3">
                You&apos;ve reached today&apos;s limit of {cap.cap} ad{cap.cap === 1 ? "" : "s"}. Come back tomorrow!
              </p>
            ) : (
              <Button size="lg" onClick={handleWatch}>
                <PlayCircle className="w-5 h-5" /> Watch Ad
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary/50" />
            <p className="font-medium">
              {phase === "starting"   ? "Preparing your ad…" :
               phase === "loading-ad" ? "Loading video ad…" :
               phase === "crediting"  ? "Crediting your account…" : "Please wait…"}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
