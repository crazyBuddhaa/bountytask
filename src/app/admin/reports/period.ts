export type Period = "7d" | "30d" | "90d"

export function shortDate(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-NG", { month: "short", day: "numeric" })
}
