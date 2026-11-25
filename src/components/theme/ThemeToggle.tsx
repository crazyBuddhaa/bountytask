"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "bt_theme"

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    let dark = document.documentElement.classList.contains("dark")
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === "dark" || saved === "light") {
        dark = saved === "dark"
      }
    } catch {
      // Ignore storage errors in restricted browsing contexts
    }
    document.documentElement.classList.toggle("dark", dark)
    setIsDark(dark)
    setMounted(true)
  }, [])

  function toggleTheme() {
    const nextDark = !isDark
    setIsDark(nextDark)
    document.documentElement.classList.toggle("dark", nextDark)
    try {
      localStorage.setItem(STORAGE_KEY, nextDark ? "dark" : "light")
    } catch {
      // Ignore storage errors in restricted browsing contexts
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      title={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle dark mode"}
    >
      {mounted ? (
        isDark ? (
          <Sun className="w-5 h-5" />
        ) : (
          <Moon className="w-5 h-5" />
        )
      ) : (
        <Moon className="w-5 h-5 opacity-0" aria-hidden="true" />
      )}
    </Button>
  )
}
