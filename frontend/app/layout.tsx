import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/SiteHeader";

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
          <SiteHeader />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
