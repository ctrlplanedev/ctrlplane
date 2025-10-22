import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "@/middleware/auth.js";
import { createV1Router } from "@/routes/index.js";
import * as trpcExpress from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import * as OpenApiValidator from "express-openapi-validator";
import helmet from "helmet";

import { auth } from "@ctrlplane/auth/server";
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

app.use((req, res, next) => {
  res.on("finish", () => {
    console.log(`${res.statusCode} - ${req.method} ${req.originalUrl}`);
  });
  next();
});

app.all("/api/auth/*splat", toNodeHandler(auth));

// Optional: OpenAPI validation middleware
app.use(
  OpenApiValidator.middleware({
    apiSpec: join(__dirname, "../openapi/openapi.json"),
    validateRequests: true,
    validateResponses: true,
    ignorePaths: /\/api\/(auth|internal|trpc)/,
  }),
);

// Apply authentication middleware to all /api/v1 routes
app.use("/api/v1", requireAuth);

// Register v1 API routes
app.use("/api/v1", createV1Router());

app.use(
  "/api/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: async (opts) => {
      const headers = Object.fromEntries(
        Object.entries(opts.req.headers)
          .filter(([_, v]) => typeof v === "string")
          .map(([k, v]) => [k, v as string]),
      );

      const session =
        (await auth.api.getSession({
          headers: new Headers(headers),
        })) ?? null;

      return createTRPCContext(session);
    },
  }),
);

export { app };
