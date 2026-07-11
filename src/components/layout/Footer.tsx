import Link from "next/link"

const links = {
  Product: [
    { label: "How it works",  href: "/#how-it-works" },
    { label: "Task Marketplace", href: "/register"   },
    { label: "Referral Program", href: "/register"   },
  ],
  Company: [
    { label: "About",   href: "/about"   },
    { label: "FAQ",     href: "/faq"     },
    { label: "Contact", href: "/contact" },
  ],
  Legal: [
    { label: "Privacy Policy",    href: "/privacy"    },
    { label: "Terms of Service",  href: "/terms"      },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-bold text-base mb-3">
              <div className="w-7 h-7 rounded-lg bounty-gradient" />
              <span className="bounty-text-gradient">BountyTask</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Earn real Naira completing simple online tasks. Trusted by thousands of Nigerians.
            </p>
          </div>

          {/* Link groups */}
          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{group}</p>
              <ul className="space-y-2">
                {items.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} BountyTask. All rights reserved.</p>
          <p>Made with ❤️ in Nigeria 🇳🇬</p>
        </div>
      </div>
    </footer>
  )
}
