"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") ?? "");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (password !== confirmPassword) {
      setError("New password and confirm password must match.");
      return;
    }
    if (!token) {
      setError("Password reset link is missing a token.");
      return;
    }

    setLoading(true);

    try {
      const result = await apiFetch<{ message: string }>(
        "/api/auth/reset-password",
        {
          method: "POST",
          body: {
            token,
            password,
            confirm_password: confirmPassword
          }
        }
      );
      setMessage(result.message);
      window.setTimeout(() => router.replace("/login"), 1200);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to reset password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page form-wrap">
      <div>
        <span className="eyebrow">Account recovery</span>
        <h1 className="page-title">Reset password.</h1>
        <p className="lede">
          Set a new password. You will not be logged in automatically after the
          reset.
        </p>
      </div>

      <form className="form-card" onSubmit={submit}>
        <div className="field">
          <label htmlFor="reset-password">New password</label>
          <input
            id="reset-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="reset-confirm-password">Confirm new password</label>
          <input
            id="reset-confirm-password"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={loading}
            required
          />
        </div>
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Resetting..." : "Reset password"}
        </button>
        <Link className="text-link" href="/login">
          Back to login
        </Link>
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
  );
}
