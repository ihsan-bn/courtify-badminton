"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import {
  apiFetch,
  ApiError,
  type RequestOtpResponse,
  type VerifyOtpResponse
} from "@/lib/api";
import { setAccessToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("+673");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"request" | "verify" | null>(null);

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setDevOtp(null);
    setLoading("request");

    try {
      const result = await apiFetch<RequestOtpResponse>(
        "/api/auth/request-otp",
        {
          method: "POST",
          body: { phone_number: phoneNumber.trim() }
        }
      );
      setOtpRequested(true);
      setMessage(`OTP sent. It expires in ${result.expires_in_seconds / 60} minutes.`);
      if (result.otp) {
        setDevOtp(result.otp);
      }
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

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading("verify");

    try {
      const result = await apiFetch<VerifyOtpResponse>(
        "/api/auth/verify-otp",
        {
          method: "POST",
          body: {
            phone_number: phoneNumber.trim(),
            otp: otp.trim()
          }
        }
      );
      setAccessToken(result.access_token);
      router.replace(
        result.onboarding_required ? "/onboarding" : "/dashboard"
      );
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

  return (
    <section className="page form-wrap">
      <div>
        <span className="eyebrow">Passwordless login</span>
        <h1 className="page-title">Login with your Brunei phone number.</h1>
        <p className="lede">
          Enter your phone number, receive a six-digit OTP, then continue to
          your customer dashboard.
        </p>
      </div>

      <form className="form-card" onSubmit={requestOtp}>
        <div className="field">
          <label htmlFor="phone-number">Phone number</label>
          <input
            id="phone-number"
            name="phone-number"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            pattern="^\+673[2-8][0-9]{6}$"
            placeholder="+6738123456"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            required
          />
          <span className="hint">Use Brunei format, for example +6738123456.</span>
        </div>
        <button
          className="button"
          type="submit"
          disabled={loading !== null}
        >
          {loading === "request" ? "Requesting..." : "Request OTP"}
        </button>
      </form>

      {otpRequested ? (
        <form className="form-card" onSubmit={verifyOtp}>
          <div className="field">
            <label htmlFor="otp">Six-digit OTP</label>
            <input
              id="otp"
              name="otp"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="^[0-9]{6}$"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              required
            />
          </div>
          <button
            className="button"
            type="submit"
            disabled={loading !== null}
          >
            {loading === "verify" ? "Verifying..." : "Verify and continue"}
          </button>
        </form>
      ) : null}

      {message ? <p className="notice" role="status">{message}</p> : null}
      {devOtp ? (
        <p className="notice" role="status">
          Local testing OTP: <strong>{devOtp}</strong>
        </p>
      ) : null}
      {error ? <p className="alert" role="alert">{error}</p> : null}
    </section>
  );
}
