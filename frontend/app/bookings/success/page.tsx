import Link from "next/link";

export default function BookingSuccessPage() {
  return (
    <section className="page form-wrap">
      <div className="hero-card">
        <span className="eyebrow">Payment received</span>
        <h1 className="page-title">Your booking is being confirmed.</h1>
        <p className="lede">
          Stripe has received your payment. Courtify-Badminton is finalizing
          your booking confirmation through the secure payment webhook.
        </p>
        <div className="actions">
          <Link className="button" href="/dashboard">
            Go to Dashboard
          </Link>
          <Link className="button-secondary" href="/dashboard">
            My Bookings placeholder
          </Link>
        </div>
      </div>
    </section>
  );
}
