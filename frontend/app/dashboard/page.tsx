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

    async function loadProfile() {
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
          router.replace("/login");
          return;
        }
        if (mounted) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "Unable to load your profile."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [router]);

  function handleLogout() {
    clearAccessToken();
    router.replace("/login");
  }

  return (
    <AuthGuard>
      <section className="page">
        <div>
          <span className="eyebrow">Customer dashboard</span>
          <h1 className="page-title">
            {user?.name ? `Welcome, ${user.name}.` : "Welcome to Courtify."}
          </h1>
          <p className="lede">
            Your booking tools will live here. For now, this dashboard confirms
            that phone OTP login and customer onboarding are wired end to end.
          </p>
        </div>

        {loading ? <p className="loading">Loading profile...</p> : null}
        {error ? <p className="alert" role="alert">{error}</p> : null}

        {user ? (
          <section className="card" aria-label="Customer profile">
            <h2>Profile</h2>
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
            <div className="actions">
              <button className="button-ghost" type="button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </section>
        ) : null}

        <section className="dashboard-grid" aria-label="Future booking tools">
          {user?.role === "admin" ? (
            <article className="card">
              <h3>Cancellation Management</h3>
              <p>Review pending requests and update customer timelines.</p>
              <div className="actions">
                <Link
                  className="button-secondary"
                  href="/admin/cancellations"
                >
                  Open cancellation queue
                </Link>
              </div>
            </article>
          ) : null}
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
            <h3>Cancel Booking</h3>
            <p>Placeholder for cancellation and refund eligibility actions.</p>
          </article>
        </section>
      </section>
    </AuthGuard>
  );
}
