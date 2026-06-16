import Link from "next/link";

export default function HomePage() {
  return (
    <section className="page hero">
      <div className="hero-card">
        <span className="eyebrow">08:00 to 22:00 daily · BND pricing</span>
        <h1>Book badminton courts without the back-and-forth.</h1>
        <p className="lede">
          Courtify-Badminton is the customer portal for reserving badminton
          courts in Brunei. Phase 5A starts with secure phone OTP login and a
          clean customer dashboard foundation.
        </p>
        <div className="actions">
          <Link className="button" href="/login">
            Login with phone OTP
          </Link>
          <Link className="button-secondary" href="/dashboard">
            Go to dashboard
          </Link>
        </div>
      </div>
      <aside className="card" aria-label="Current phase">
        <h2>Customer foundation</h2>
        <p>
          Phone OTP authentication, first-time onboarding, and customer profile
          access are ready here. Booking and payment screens arrive in later
          phases.
        </p>
      </aside>
    </section>
  );
}
