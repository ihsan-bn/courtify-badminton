# 🏸 Courtify-Badminton

Courtify-Badminton is a modern badminton court booking platform designed for badminton venue operators in Brunei Darussalam.

The platform provides customer self-service court reservations, Stripe payment processing, cancellation and refund workflows, administrative operations dashboards, transactional email notifications, and downloadable PDF receipts.

---

## 🚀 Current Version

**v0.8B – PDF Receipts & Documents**

---

## ✨ Features

### Customer Portal

- Phone OTP authentication
- Customer onboarding
- Court availability search
- Consecutive hourly slot booking
- Real-time booking lock management
- Stripe Checkout payment integration
- Booking history
- Booking details page
- Cancellation request workflow
- Refund status tracking
- PDF receipt downloads

### Booking Engine

- Multi-court management
- Consecutive slot reservations
- Automatic lock expiration
- Reservation conflict prevention
- Booking status lifecycle management

### Payments

- Stripe Checkout integration
- Webhook-based booking confirmation
- Payment event tracking
- Expired payment handling
- Failed payment handling
- Payment audit history

### Cancellation Management

- Customer cancellation requests
- Two-step cancellation confirmation
- Typed confirmation ("CANCEL BOOKING")
- 24-hour cancellation policy enforcement
- Administrative review workflow
- Approval and rejection handling
- Full cancellation timeline tracking

### Refund Management

- Manual refund workflow
- Refund reference tracking
- Refund method recording
- Refund progress tracking
- Refund completion workflow
- Case closure management

### Administrative Portal

- Operations dashboard
- Occupancy overview
- Active booking monitoring
- Upcoming booking visibility
- Cancellation queue
- Refund queue
- Cancellation case management
- Customer timeline management

### Notifications

- Booking confirmation emails
- Cancellation request emails
- Cancellation approval emails
- Refund completion emails
- Case closure emails
- Notification delivery history

### PDF Documents

- Booking Receipt
- Cancellation Receipt
- Refund Receipt
- Administrative Case Summary

---

## 🏗️ Technology Stack

### Frontend

- Next.js 15
- React
- TypeScript

### Backend

- Node.js
- Express 5
- TypeScript

### Database

- PostgreSQL
- Supabase

### Payments

- Stripe Checkout
- Stripe Webhooks

### Authentication

- OTP-based login
- JWT authentication

### Notifications

- Pluggable email provider architecture

---

## 📁 Project Structure

```text
courtify-badminton/
│
├── backend/
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── package.json
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
├── README.md
├── FEstart.bat
└── BEstart.bat
```

---

## ⚙️ Local Development

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on:

```text
http://localhost:4000
```

---

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:

```text
http://localhost:3000
```

---

### Stripe Webhook Listener

Required for local payment testing.

```bash
stripe listen --forward-to localhost:4000/api/payments/webhook
```

---

## 🔥 Startup Checklist

Before testing payments:

### Terminal 1

```bash
cd backend
npm run dev
```

### Terminal 2

```bash
cd frontend
npm run dev
```

### Terminal 3

```bash
stripe listen --forward-to localhost:4000/api/payments/webhook
```

All three services should be running.

---

## 📊 Booking Lifecycle

```text
Customer Login
      │
      ▼
Select Court & Slots
      │
      ▼
Create Booking Lock
      │
      ▼
Stripe Checkout
      │
      ▼
Payment Success
      │
      ▼
Booking Confirmed
      │
      ▼
Customer Uses Court
```

---

## 📋 Cancellation Lifecycle

```text
Customer Requests Cancellation
             │
             ▼
Pending Admin Review
             │
             ▼
Admin Verification
             │
             ▼
Customer Contacted
             │
             ▼
Approved / Rejected
             │
             ▼
Refund Processing
             │
             ▼
Case Closed
```

---

## 📄 Available Documents

### Customer

- Booking Receipt
- Cancellation Receipt
- Refund Receipt

### Administrator

- Cancellation Case Summary

---

## 🔒 Security Features

- JWT authentication
- Role-based authorization
- Ownership validation
- Customer data isolation
- Stripe webhook verification
- Transaction-safe booking workflows
- Idempotent payment handling
- Secure PDF generation
- Audit-friendly status tracking

---

## 🗺️ Roadmap

### v0.9A

- Business reporting
- CSV exports
- Excel exports
- Revenue reporting

### v0.9B

- Administrative audit logs
- User activity tracking

### v0.9C

- Multi-admin management
- Role administration

### v1.0

- Production deployment
- Production email provider
- Monitoring and observability
- Operational hardening

---

## 👨‍💻 Author

Developed by **Muhammad Ihsan Hazwan Hj Bungsu**

Senior Executive, ISS Cybersecurity  
Imagine Sdn Bhd  
Brunei Darussalam

---

## 📜 License

Private project. All rights reserved.
