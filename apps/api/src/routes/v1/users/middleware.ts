import type { Handler } from "@/types/api.js";
import { ForbiddenError } from "@/types/api.js";

/**
 * Example middleware specific to user routes
 * This could check if the user has permission to access user resources
 */
export const checkUserPermissions: Handler = async (c, req, res, next) => {
  const { session } = req.apiContext ?? {};

  // Example permission check
  // In a real application, you might check user roles or permissions here
  if (!session?.user) {
    throw new ForbiddenError("Insufficient permissions");
  }

  // Check if user is admin or accessing their own data
  const { userId } = c.request.params;
  const isAdmin = session.user.role === "admin"; // assuming role exists
  const isOwnProfile = userId === session.user.id;

  if (!isAdmin && !isOwnProfile && userId) {
    throw new ForbiddenError("You can only access your own user data");
  }

  if (next) next();
};

/**
 * Rate limiting middleware example
 * This is a placeholder - in production, use a proper rate limiting solution
 */
export const rateLimitUsers: Handler = async (c, req, res, next) => {
  // Implement rate limiting logic here
  // For example, using redis to track request counts

  // For now, just pass through
  if (next) next();
};
