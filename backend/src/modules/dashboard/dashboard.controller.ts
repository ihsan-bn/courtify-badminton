import type { RequestHandler } from "express";

import { dashboardService } from "./dashboard.service.js";
import { auditService } from "../audit/audit.service.js";

export const getDashboardSummary: RequestHandler = async (
  request,
  response
) => {
  const summary = await dashboardService.getSummary();
  await auditService.record({
    actor: {
      userId: request.authenticatedUser?.id ?? null,
      role: "admin"
    },
    action: "admin_dashboard_viewed",
    entityType: "admin_dashboard",
    summary: "Administrator viewed the executive dashboard.",
    request
  });
  response.status(200).json(summary);
};

export const getDashboardOperations: RequestHandler = async (
  _request,
  response
) => {
  const operations = await dashboardService.getOperations();
  response.status(200).json(operations);
};

export const getDashboardAnalytics: RequestHandler = async (
  _request,
  response
) => {
  const analytics = await dashboardService.getAnalytics();
  response.status(200).json(analytics);
};
