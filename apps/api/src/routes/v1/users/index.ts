import type { Handler, QueryParams, ResponseBody } from "@/types/api.js";
import {
  BadRequestError,
  NotFoundError,
  sendResponse,
  UnauthorizedError,
} from "@/types/api.js";

/**
 * GET /v1/users
 * List all users with pagination
 */
export const listUsers: Handler = async (c, req, res) => {
  const { session } = req.apiContext ?? {};

  if (!session) {
    throw new UnauthorizedError();
  }

  // Get query parameters with type safety
  const query = c.request.query as QueryParams<"/v1/users", "get">;
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;

  // Example response - in real implementation, fetch from database
  const users: ResponseBody<"/v1/users", "get">["data"] = [
    {
      id: "123e4567-e89b-12d3-a456-426614174000",
      email: "user1@example.com",
      name: "User One",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "223e4567-e89b-12d3-a456-426614174000",
      email: "user2@example.com",
      name: "User Two",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // Apply pagination
  const paginatedUsers = users.slice(offset, offset + limit);

  sendResponse<ResponseBody<"/v1/users", "get">>(res, 200, {
    data: paginatedUsers,
    total: users.length,
  });
};

/**
 * POST /v1/users
 * Create a new user
 */
export const createUser: Handler = async (c, req, res) => {
  const { session } = req.apiContext ?? {};

  if (!session) {
    throw new UnauthorizedError();
  }

  // Get request body with type safety
  const body = c.request.requestBody as {
    email: string;
    name: string;
  };

  if (!body.email || !body.name) {
    throw new BadRequestError("Email and name are required");
  }

  // Example response - in real implementation, create in database
  const newUser: ResponseBody<"/v1/users", "post"> = {
    id: crypto.randomUUID(),
    email: body.email,
    name: body.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  sendResponse<ResponseBody<"/v1/users", "post">>(res, 201, newUser);
};

/**
 * GET /v1/users/{userId}
 * Get a specific user by ID
 */
export const getUser: Handler = async (c, req, res) => {
  const { session } = req.apiContext ?? {};

  if (!session) {
    throw new UnauthorizedError();
  }

  const { userId } = c.request.params;

  if (!userId) {
    throw new BadRequestError("User ID is required");
  }

  // Example response - in real implementation, fetch from database
  // For now, just check if the ID format is valid
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new BadRequestError("Invalid user ID format");
  }

  // Simulate user not found for specific ID
  if (userId === "00000000-0000-0000-0000-000000000000") {
    throw new NotFoundError("User not found");
  }

  const user: ResponseBody<"/v1/users/{userId}", "get"> = {
    id: userId,
    email: "user@example.com",
    name: "Example User",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  sendResponse<ResponseBody<"/v1/users/{userId}", "get">>(res, 200, user);
};

/**
 * PATCH /v1/users/{userId}
 * Update a specific user
 */
export const updateUser: Handler = async (c, req, res) => {
  const { session } = req.apiContext ?? {};

  if (!session) {
    throw new UnauthorizedError();
  }

  const { userId } = c.request.params;
  const body = c.request.requestBody as {
    email?: string;
    name?: string;
  };

  if (!userId) {
    throw new BadRequestError("User ID is required");
  }

  // Simulate user not found
  if (userId === "00000000-0000-0000-0000-000000000000") {
    throw new NotFoundError("User not found");
  }

  // Example response - in real implementation, update in database
  const updatedUser: ResponseBody<"/v1/users/{userId}", "patch"> = {
    id: userId,
    email: body.email ?? "user@example.com",
    name: body.name ?? "Example User",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  sendResponse<ResponseBody<"/v1/users/{userId}", "patch">>(
    res,
    200,
    updatedUser,
  );
};

/**
 * DELETE /v1/users/{userId}
 * Delete a specific user
 */
export const deleteUser: Handler = async (c, req, res) => {
  const { session } = req.apiContext ?? {};

  if (!session) {
    throw new UnauthorizedError();
  }

  const { userId } = c.request.params;

  if (!userId) {
    throw new BadRequestError("User ID is required");
  }

  // Simulate user not found
  if (userId === "00000000-0000-0000-0000-000000000000") {
    throw new NotFoundError("User not found");
  }

  // Example - in real implementation, delete from database
  res.status(204).send();
};
