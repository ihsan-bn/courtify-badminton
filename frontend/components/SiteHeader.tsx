"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch, ApiError, type UserProfile } from "@/lib/api";
import {
  clearAccessToken,
  getAccessToken,
  logout
} from "@/lib/auth";

function getInitials(user: UserProfile): string {
  if (user.name?.trim()) {
    return user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  const fallback = user.email ?? user.phone_number;
  return fallback.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "CB";
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const isPublicAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      if (isPublicAuthPage || !getAccessToken()) {
        setUser(null);
        return;
      }

      try {
        const result = await apiFetch<{ user: UserProfile }>("/api/me", {
          auth: true
        });
        if (mounted) {
          setUser(result.user);
        }
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          clearAccessToken();
          if (mounted) {
            setUser(null);
          }
          router.replace("/login");
        }
      }
    }

    void loadUser();
    return () => {
      mounted = false;
    };
  }, [isPublicAuthPage, pathname, router]);

  return (
    <header className="site-header" aria-label="Main navigation">
      <Link
        className="brand"
        href={user?.role === "admin" ? "/admin/dashboard" : user ? "/dashboard" : "/"}
      >
        <span className="brand-mark" aria-hidden="true">
          CB
        </span>
        <span>
          <strong>Courtify-Badminton</strong>
          <small>Brunei court booking</small>
        </span>
      </Link>

      {isPublicAuthPage ? null : user ? (
        <div className="authenticated-nav">
          <nav className="site-nav" aria-label="Authenticated navigation">
            <Link href={user.role === "admin" ? "/admin/dashboard" : "/dashboard"}>
              Dashboard
            </Link>
            {user.role === "admin" ? (
              <>
                <Link href="/admin/cancellations">Cancellations</Link>
                <Link href="/admin/reports">Reports</Link>
              </>
            ) : (
              <>
                <Link href="/book">Book</Link>
                <Link href="/bookings">Bookings</Link>
              </>
            )}
            <Link href="/profile">Profile</Link>
          </nav>
          <details className="profile-menu">
            <summary aria-label="Open account menu">
              <span className="profile-avatar" aria-hidden="true">
                {getInitials(user)}
              </span>
              <span className="profile-copy">
                <strong>{user.name ?? user.email ?? user.phone_number}</strong>
                <small>{user.email ?? user.phone_number}</small>
              </span>
              <span className={`role-badge role-${user.role}`}>
                {user.role}
              </span>
            </summary>
            <div className="profile-menu-panel">
              <p>
                Signed in as <strong>{user.name ?? "Courtify user"}</strong>
              </p>
              <span>{user.phone_number}</span>
              {user.email ? <span>{user.email}</span> : null}
              <Link className="profile-menu-link" href="/profile">
                Update Profile
              </Link>
              <Link className="profile-menu-link" href="/change-password">
                Change Password
              </Link>
              <button
                className="button-ghost profile-logout"
                type="button"
                onClick={() => logout()}
              >
                Logout
              </button>
            </div>
          </details>
        </div>
      ) : (
        <nav className="site-nav" aria-label="Primary">
          <Link href="/login">Login</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
      )}
    </header>
  );
}
