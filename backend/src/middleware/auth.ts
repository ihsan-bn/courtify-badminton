import type { RequestHandler } from "express";

import { usersRepository } from "../modules/users/users.repository.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";
import {
  type UserRole,
  verifyAccessToken
} from "../utils/jwt.js";

declare module "express-serve-static-core" {
  interface Request {
    authenticatedUser?: {
      id: string;
      role: UserRole;
    };
  }
}

export const authenticate: RequestHandler = async (request, _response, next) => {
  const authorization = request.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    next(new UnauthorizedError());
    return;
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    next(new UnauthorizedError());
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await usersRepository.findById(payload.sub);

    if (user?.role !== payload.role) {
      next(new UnauthorizedError("User account is unavailable"));
      return;
    }

    request.authenticatedUser = { id: user.id, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin: RequestHandler = (request, _response, next) => {
  if (!request.authenticatedUser) {
    next(new UnauthorizedError());
    return;
  }

  if (request.authenticatedUser.role !== "admin") {
    next(new ForbiddenError("Administrator access required"));
    return;
  }

  next();
};
