import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "@/middleware/auth.js";
import { errorHandler } from "@/middleware/error-handler.js";
import { registerHandlers } from "@/routes/index.js";
import { ExpressAuth } from "@auth/express";
import GitHub from "@auth/express/providers/github";
import * as trpcExpress from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import * as OpenApiValidator from "express-openapi-validator";
import helmet from "helmet";
import OpenAPIBackend from "openapi-backend";

import { appRouter, createTRPCContext } from "@ctrlplane/trpc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Set the application to trust the reverse proxy
app.set("trust proxy", true);

// Middleware
app.use(cors({ credentials: true }));
app.use(helmet());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.set("trust proxy", true);
app.use("/api/auth/*splat", ExpressAuth({ providers: [GitHub] }));

// Initialize OpenAPI Backend
const api = new OpenAPIBackend({
  definition: join(__dirname, "../openapi/openapi.json"),
  strict: false,
  validate: true,
  ajvOpts: {
    strict: false,
  },
});

// Register all route handlers
registerHandlers(api);

// Initialize the API
await api.init();

// Apply authentication middleware to all /api/v1 routes
app.use("/api/v1", requireAuth);

// OpenAPI routes - handle all /api/v1 requests through OpenAPI Backend
app.use("/api/v1", (req, res) =>
  api.handleRequest(req as any, req as any, res),
);

// Additional validation with express-openapi-validator (optional, for extra validation layer)
app.use(
  OpenApiValidator.middleware({
    apiSpec: join(__dirname, "../openapi/openapi.json"),
    validateRequests: true,
    validateResponses: true,
    ignorePaths: /\/api\/(auth|internal)/,
  }),
);

app.use(
  "/api/internal/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => createTRPCContext(),
  }),
);

// Global error handler - must be last
app.use(errorHandler);

export { app };
