"use client";

import { type FormEvent, useEffect, useState } from "react";

import { AuthGuard } from "@/components/AuthGuard";
import { apiFetch, ApiError, type UserProfile } from "@/lib/api";

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState<UserProfile["role"] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const result = await apiFetch<{ user: UserProfile }>("/api/me", {
          auth: true
        });
        if (!mounted) {
          return;
        }
        setName(result.user.name ?? "");
        setEmail(result.user.email ?? "");
        setPhoneNumber(result.user.phone_number);
        setRole(result.user.role);
      } catch (caught) {
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

    void loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);

    try {
      const result = await apiFetch<{ user: UserProfile }>("/api/me/profile", {
        method: "PATCH",
        auth: true,
        body: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone_number: phoneNumber.trim()
        }
      });
      setName(result.user.name ?? "");
      setEmail(result.user.email ?? "");
      setPhoneNumber(result.user.phone_number);
      setRole(result.user.role);
      setMessage("Profile updated.");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to update your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGuard>
      <section className="page form-wrap">
        <div>
          <span className="eyebrow">Account</span>
          <h1 className="page-title">Update profile.</h1>
          <p className="lede">
            Update your name, email, and Brunei phone number. Your role remains
            protected by the server.
          </p>
        </div>

        {loading ? <p className="loading">Loading profile...</p> : null}

        <form className="form-card" onSubmit={submit}>
          <div className="field">
            <label htmlFor="profile-name">Full name</label>
            <input
              id="profile-name"
              name="name"
              type="text"
              autoComplete="name"
              maxLength={150}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={loading || saving}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="profile-email">Email address</label>
            <input
              id="profile-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading || saving}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="profile-phone">Phone number</label>
            <input
              id="profile-phone"
              name="phone-number"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              pattern="^\+673[2-8][0-9]{6}$"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              disabled={loading || saving}
              required
            />
          </div>
          <div className="profile-row">
            <span>Role</span>
            <strong>{role ?? "Loading"}</strong>
          </div>
          <button className="button" type="submit" disabled={loading || saving}>
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>

        {message ? (
          <p className="notice" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </AuthGuard>
  );
}
