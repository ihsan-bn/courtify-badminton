"use client";

import { type FormEvent, useState } from "react";

import { AuthGuard } from "@/components/AuthGuard";
import { apiFetch, ApiError } from "@/lib/api";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (newPassword !== confirmNewPassword) {
      setError("New password and confirm password must match.");
      return;
    }

    setLoading(true);

    try {
      const result = await apiFetch<{ message: string }>(
        "/api/me/change-password",
        {
          method: "POST",
          auth: true,
          body: {
            current_password: currentPassword,
            new_password: newPassword,
            confirm_new_password: confirmNewPassword
          }
        }
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setMessage(result.message);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to change your password."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGuard>
      <section className="page form-wrap">
        <div>
          <span className="eyebrow">Account security</span>
          <h1 className="page-title">Change password.</h1>
          <p className="lede">
            Your current session remains active after a successful password
            change. Use logout on shared devices.
          </p>
        </div>

        <form className="form-card" onSubmit={submit}>
          <div className="field">
            <label htmlFor="current-password">Current password</label>
            <input
              id="current-password"
              name="current-password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              maxLength={128}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-new-password">Confirm new password</label>
            <input
              id="confirm-new-password"
              name="confirm-new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              disabled={loading}
              required
            />
          </div>
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Changing..." : "Change password"}
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
