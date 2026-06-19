"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { AdminGuard } from "@/components/AdminGuard";

interface AdminNavItem {
  label: string;
  href: string;
  match?: string;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", match: "/admin/dashboard" },
  { label: "Bookings", href: "/admin/dashboard#bookings" },
  { label: "Operations", href: "/admin/dashboard#operations" },
  { label: "Live Occupancy", href: "/admin/dashboard#live-occupancy" },
  { label: "Today\u2019s Bookings", href: "/admin/dashboard#todays-bookings" },
  { label: "Upcoming Bookings", href: "/admin/dashboard#upcoming-bookings" },
  { label: "Cancellations", href: "/admin/cancellations", match: "/admin/cancellations" },
  { label: "Refunds", href: "/admin/dashboard#refunds" },
  { label: "Revenue Analytics", href: "/admin/analytics", match: "/admin/analytics" },
  { label: "Business Reports", href: "/admin/reports", match: "/admin/reports" },
  { label: "Courts", href: "/admin/dashboard#courts" },
  { label: "Audit Logs", href: "/admin/audit-logs", match: "/admin/audit-logs" }
];

function getHashFromHref(href: string): string | null {
  const hashIndex = href.indexOf("#");
  return hashIndex >= 0 ? href.slice(hashIndex) : null;
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function syncHash() {
      setActiveHash(window.location.hash);
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  function isActive(item: AdminNavItem): boolean {
    const itemHash = getHashFromHref(item.href);
    if (itemHash) {
      return pathname === "/admin/dashboard" && activeHash === itemHash;
    }
    if (item.href === "/admin/dashboard") {
      return pathname === "/admin/dashboard" && !activeHash;
    }
    return item.match ? pathname.startsWith(item.match) : pathname === item.href;
  }

  return (
    <AdminGuard>
      <div className="admin-shell">
        <button
          className="admin-menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="admin-sidebar"
          onClick={() => setMenuOpen((current) => !current)}
        >
          {menuOpen ? "Close admin menu" : "Admin menu"}
        </button>

        <aside
          id="admin-sidebar"
          className={`admin-sidebar ${menuOpen ? "admin-sidebar-open" : ""}`}
          aria-label="Administrator navigation"
        >
          <div className="admin-sidebar-heading">
            <span className="eyebrow">Admin Console</span>
            <strong>Courtify Control</strong>
          </div>
          <nav className="admin-sidebar-nav">
            {ADMIN_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                className={isActive(item) ? "admin-nav-active" : undefined}
                href={item.href}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="admin-main">{children}</main>
      </div>
    </AdminGuard>
  );
}
