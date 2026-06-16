"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { AuthGuard } from "@/components/AuthGuard";
import { apiFetch, ApiError, type UserProfile } from "@/lib/api";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function completeOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiFetch<{ user: UserProfile }>("/api/me/onboarding", {
        method: "POST",
        auth: true,
        body: {
          name: name.trim(),
          email: email.trim().toLowerCase()
        }
      });
      router.replace("/dashboard");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to complete onboarding. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGuard>
      <section className="page form-wrap">
        <div>
          <span className="eyebrow">First-time setup</span>
          <h1 className="page-title">Finish your customer profile.</h1>
          <p className="lede">
            We need your name and email before you can use the customer
            dashboard.
          </p>
        </div>

        <form className="form-card" onSubmit={completeOnboarding}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={150}
            />
          </div>

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
            />
          </div>

          <button className="button" type="submit" disabled={loading}>
            {loading ? "Saving..." : "Complete onboarding"}
          </button>
        </form>

        {error ? <p className="alert" role="alert">{error}</p> : null}
      </section>
    </AuthGuard>
  );
}
