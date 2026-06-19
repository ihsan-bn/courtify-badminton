"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import {
  apiFetch,
  ApiError,
  type RequestOtpResponse,
  type VerifyOtpResponse
} from "@/lib/api";
import { setAccessToken } from "@/lib/auth";

type LoadingAction = "request-otp" | "complete-registration";

export default function RegisterPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("+673");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoadingAction | null>(null);

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setDevOtp(null);
    setLoading("request-otp");

    try {
      const result = await apiFetch<RequestOtpResponse>(
        "/api/auth/registration/request-otp",
        {
          method: "POST",
          body: { phone_number: phoneNumber.trim() }
        }
      );
      setOtpRequested(true);
      setMessage(`OTP sent. It expires in ${result.expires_in_seconds / 60} minutes.`);
      setDevOtp(result.otp ?? null);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to request OTP. Please try again."
      );
    } finally {
      setLoading(null);
    }
  }

  async function completeRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("Password and confirm password must match.");
      return;
    }

    setLoading("complete-registration");

    try {
      const result = await apiFetch<VerifyOtpResponse>(
        "/api/auth/registration/complete",
        {
          method: "POST",
          body: {
            phone_number: phoneNumber.trim(),
            otp: otp.trim(),
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            confirm_password: confirmPassword
          }
        }
      );
      setAccessToken(result.access_token);
      router.replace("/dashboard");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to complete registration. Please try again."
      );
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <section className="page form-wrap">
      <div>
        <span className="eyebrow">First Time User</span>
        <h1 className="page-title">Register with your phone number.</h1>
        <p className="lede">
          Phone OTP confirms your first-time registration. After that, you will
          use email, password, and OTP for future logins.
        </p>
      </div>

      {!otpRequested ? (
        <form className="form-card" onSubmit={requestOtp}>
          <div className="field">
            <label htmlFor="register-phone">Phone number</label>
            <input
              id="register-phone"
              name="phone-number"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              pattern="^\+673[2-8][0-9]{6}$"
              placeholder="+6738123456"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              disabled={busy}
              required
            />
            <span className="hint">For example, +6738123456.</span>
          </div>
          <button className="button" type="submit" disabled={busy}>
            {loading === "request-otp" ? "Requesting..." : "Send registration OTP"}
          </button>
          <Link className="text-link" href="/login">
            Already registered? Login instead.
          </Link>
        </form>
      ) : (
        <form className="form-card" onSubmit={completeRegistration}>
          <div className="field">
            <label htmlFor="registration-otp">Six-digit OTP</label>
            <input
              id="registration-otp"
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
          <div className="field">
            <label htmlFor="full-name">Full name</label>
            <input
              id="full-name"
              name="name"
              type="text"
              autoComplete="name"
              maxLength={150}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="register-email">Email address</label>
            <input
              id="register-email"
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
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-password">Confirm password</label>
            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={busy}
              required
            />
          </div>
          <button className="button" type="submit" disabled={busy}>
            {loading === "complete-registration"
              ? "Creating account..."
              : "Create account"}
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
            Use a different phone number
          </button>
        </form>
      )}

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
