"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      const result = await apiFetch<{ message: string }>(
        "/api/auth/forgot-password",
        {
          method: "POST",
          body: { email: email.trim().toLowerCase() }
        }
      );
      setMessage(result.message);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to request a password reset. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page form-wrap">
      <div>
        <span className="eyebrow">Account recovery</span>
        <h1 className="page-title">Forgot password?</h1>
        <p className="lede">
          Enter your registered email. If it exists, we will send a reset link
          that expires in 30 minutes.
        </p>
      </div>

      <form className="form-card" onSubmit={submit}>
        <div className="field">
          <label htmlFor="forgot-email">Email address</label>
          <input
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
            required
          />
        </div>
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
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
