"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import {
  apiFetch,
  ApiError,
  type RequestEmailPasswordOtpResponse,
  type VerifyOtpResponse
} from "@/lib/api";
import { setAccessToken } from "@/lib/auth";

type LoadingAction = "request-email" | "verify-email";
type OtpChannel = "email" | "sms";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpChannel, setOtpChannel] = useState<OtpChannel>("email");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoadingAction | null>(null);

  function handleSuccessfulLogin(result: VerifyOtpResponse) {
    setAccessToken(result.access_token);
    if (result.user.role === "admin") {
      router.replace("/admin/dashboard");
      return;
    }
    router.replace(result.onboarding_required ? "/onboarding" : "/dashboard");
  }

  async function requestEmailOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setDevOtp(null);
    setLoading("request-email");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = await apiFetch<RequestEmailPasswordOtpResponse>(
        "/api/auth/request-email-password-otp",
        {
          method: "POST",
          body: {
            email: normalizedEmail,
            password,
            otp_channel: otpChannel
          }
        }
      );
      setEmail(normalizedEmail);
      setPassword("");
      setOtpRequested(true);
      setMessage(
        `Password accepted. OTP sent by ${otpChannel.toUpperCase()} and expires in ${result.expires_in_seconds / 60} minutes.`
      );
      setDevOtp(result.otp ?? null);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to continue. Please try again."
      );
    } finally {
      setLoading(null);
    }
  }

  async function verifyEmailOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading("verify-email");

    try {
      const result = await apiFetch<VerifyOtpResponse>(
        "/api/auth/verify-email-password-otp",
        {
          method: "POST",
          body: {
            email: email.trim().toLowerCase(),
            otp: otp.trim()
          }
        }
      );
      handleSuccessfulLogin(result);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to verify OTP. Please try again."
      );
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <section className="page auth-page">
      <div className="auth-hero">
        <span className="eyebrow">Courtify-Badminton</span>
        <h1 className="page-title">Secure account access.</h1>
        <p className="lede">
          First-time customers register with phone OTP. Existing members and
          admins login with email, password, and a second OTP check.
        </p>
      </div>

      <div className="auth-choice-grid">
        <article className="card auth-choice-card">
          <span className="eyebrow">First Time User</span>
          <h2>Register with phone number</h2>
          <p>
            Verify your Brunei phone number, set up your name, email, and
            password, then continue to your customer dashboard.
          </p>
          <Link className="button" href="/register">
            Register with phone number
          </Link>
        </article>

        <article className="card auth-choice-card">
          <span className="eyebrow">Existing Member</span>
          <h2>Login with email and password</h2>
          {!otpRequested ? (
            <form className="stacked-form" onSubmit={requestEmailOtp}>
              <div className="field">
                <label htmlFor="login-email">Email address</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                  required
                />
              </div>
              <fieldset className="radio-group">
                <legend>Where should we send your OTP?</legend>
                <label>
                  <input
                    type="radio"
                    name="otp-channel"
                    value="email"
                    checked={otpChannel === "email"}
                    onChange={() => setOtpChannel("email")}
                    disabled={busy}
                  />
                  Email
                </label>
                <label>
                  <input
                    type="radio"
                    name="otp-channel"
                    value="sms"
                    checked={otpChannel === "sms"}
                    onChange={() => setOtpChannel("sms")}
                    disabled={busy}
                  />
                  SMS
                </label>
              </fieldset>
              <button className="button" type="submit" disabled={busy}>
                {loading === "request-email"
                  ? "Checking credentials..."
                  : "Continue to OTP"}
              </button>
              <Link className="text-link" href="/forgot-password">
                Forgot password?
              </Link>
            </form>
          ) : (
            <form className="stacked-form" onSubmit={verifyEmailOtp}>
              <p className="account-confirmation">
                Completing login for <strong>{email}</strong>
              </p>
              <div className="field">
                <label htmlFor="email-otp">Six-digit OTP</label>
                <input
                  id="email-otp"
                  name="otp"
                  type="text"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="^[0-9]{6}$"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  disabled={busy}
                  required
                />
              </div>
              <button className="button" type="submit" disabled={busy}>
                {loading === "verify-email"
                  ? "Verifying..."
                  : "Verify and continue"}
              </button>
              <button
                className="button-ghost"
                type="button"
                disabled={busy}
                onClick={() => {
                  setOtpRequested(false);
                  setOtp("");
                  setDevOtp(null);
                  setMessage(null);
                  setError(null);
                }}
              >
                Use a different email
              </button>
            </form>
          )}
        </article>
      </div>

      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}
      {devOtp ? (
        <p className="notice" role="status">
          Local testing OTP: <strong>{devOtp}</strong>
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
