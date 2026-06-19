"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthGuard } from "@/components/AuthGuard";
import { apiFetch, ApiError, type UserProfile } from "@/lib/api";
import { clearAccessToken } from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const profileResult = await apiFetch<{ user: UserProfile }>("/api/me", {
          auth: true
        });
        if (!mounted) {
          return;
        }

        if (profileResult.user.role === "admin") {
          router.replace("/admin/dashboard");
          return;
        }

        setUser(profileResult.user);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          clearAccessToken();
          router.replace("/login");
          return;
        }
        if (mounted) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "Unable to load the dashboard."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <AuthGuard>
      <section className="page">
        <div>
          <span className="eyebrow">Customer dashboard</span>
          <h1 className="page-title">
            {user?.name ? `Welcome, ${user.name}.` : "Welcome to Courtify."}
          </h1>
          <p className="lede">
            Book badminton courts, review your reservations, and manage
            eligible cancellation requests.
          </p>
        </div>

        {loading ? <p className="loading">Loading dashboard...</p> : null}
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}

        {user ? (
          <section className="card" aria-label="Account profile">
            <div className="booking-card-header">
              <div>
                <h2>Profile</h2>
                <p>Customer account</p>
              </div>
              <span className="status-pill">{user.role}</span>
            </div>
            <div className="profile-list">
              <div className="profile-row">
                <span>Name</span>
                <strong>{user.name ?? "Not completed"}</strong>
              </div>
              <div className="profile-row">
                <span>Email</span>
                <strong>{user.email ?? "Not completed"}</strong>
              </div>
              <div className="profile-row">
                <span>Phone</span>
                <strong>{user.phone_number}</strong>
              </div>
            </div>
          </section>
        ) : null}

        <section className="dashboard-grid" aria-label="Customer booking tools">
          <article className="card">
            <h3>Book a Court</h3>
            <p>Select one court and reserve consecutive hourly slots.</p>
            <div className="actions">
              <Link className="button-secondary" href="/book">
                Start booking
              </Link>
            </div>
          </article>
          <article className="card">
            <h3>My Bookings</h3>
            <p>View your locked, confirmed, cancelled, and expired bookings.</p>
            <div className="actions">
              <Link className="button-secondary" href="/bookings">
                View bookings
              </Link>
            </div>
          </article>
          <article className="card">
            <h3>Account Settings</h3>
            <p>Update your contact details or change your password.</p>
            <div className="actions">
              <Link className="button-secondary" href="/profile">
                Update profile
              </Link>
            </div>
          </article>
        </section>
      </section>
    </AuthGuard>
  );
}
