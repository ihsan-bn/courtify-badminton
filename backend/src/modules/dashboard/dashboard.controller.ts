import type { RequestHandler } from "express";

import { dashboardService } from "./dashboard.service.js";

export const getDashboardSummary: RequestHandler = async (
  _request,
  response
) => {
  const summary = await dashboardService.getSummary();
  response.status(200).json(summary);
};

export const getDashboardOperations: RequestHandler = async (
  _request,
  response
) => {
  const operations = await dashboardService.getOperations();
  response.status(200).json(operations);
};
