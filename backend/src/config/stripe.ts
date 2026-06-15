import Stripe from "stripe";

import { env } from "./env.js";

export const stripe = new Stripe(env.stripeSecretKey, {
  appInfo: {
    name: "Courtify-Badminton",
    version: "1.0.0"
  }
});
