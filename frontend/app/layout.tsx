import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Courtify-Badminton",
  description: "Badminton court booking for Brunei."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="site-header" aria-label="Main navigation">
            <Link className="brand" href="/">
              <span className="brand-mark" aria-hidden="true">
                CB
              </span>
              <span>
                <strong>Courtify-Badminton</strong>
                <small>Brunei court booking</small>
              </span>
            </Link>
            <nav className="site-nav" aria-label="Primary">
              <Link href="/login">Login</Link>
              <Link href="/dashboard">Dashboard</Link>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
