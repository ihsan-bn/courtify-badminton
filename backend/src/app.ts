import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import {
  errorHandler,
  notFoundHandler
} from "./middleware/errorHandler.js";
import { globalRateLimiter } from "./middleware/rateLimit.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import {
  adminCourtsRouter,
  publicCourtsRouter
} from "./modules/courts/courts.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { ForbiddenError } from "./utils/errors.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.trustProxy);

// Security and parsing middleware run before every public and protected route.
app.use(requestLogger);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsAllowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ForbiddenError("Origin is not allowed by CORS"));
    },
    methods: ["GET", "POST", "PATCH"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
    maxAge: 600
  })
);
app.use(express.json({ limit: "32kb", strict: true }));
app.use(globalRateLimiter);

app.use("/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/me", usersRouter);
app.use("/api/courts", publicCourtsRouter);
app.use("/api/admin/courts", adminCourtsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
