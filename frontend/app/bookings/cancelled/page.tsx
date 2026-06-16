import Link from "next/link";

export default function BookingCancelledPage() {
  return (
    <section className="page form-wrap">
      <div className="hero-card">
        <span className="eyebrow">Payment cancelled</span>
        <h1 className="page-title">No payment was completed.</h1>
        <p className="lede">
          Your temporary court lock may remain for up to 10 minutes before it
          expires. You can return to booking and choose another slot if needed.
        </p>
        <div className="actions">
          <Link className="button" href="/book">
            Back to Booking
          </Link>
          <Link className="button-secondary" href="/dashboard">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
