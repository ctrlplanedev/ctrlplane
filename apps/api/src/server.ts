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

import { createGithubRouter } from "./routes/github/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const oapiValidatorMiddleware = OpenApiValidator.middleware({
  apiSpec: join(__dirname, "../openapi/openapi.json"),
  validateRequests: true,
  validateResponses: true,
  ignorePaths: /\/api\/(auth|internal|trpc|github)/,
});

const trpcMiddleware = trpcExpress.createExpressMiddleware({
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
});

const loggerMiddleware: express.RequestHandler = (req, res, next) => {
  res.on("finish", () =>
    console.log(`${res.statusCode} - ${req.method} ${req.originalUrl}`),
  );
  next();
};

const app = express()
  .set("trust proxy", true)
  .use(cors({ credentials: true }))
  .use(helmet())
  .use(express.urlencoded({ extended: true }))
  .use(express.json())
  .use(cookieParser())
  .use(loggerMiddleware)
  .all("/api/auth/*splat", toNodeHandler(auth))
  .use(oapiValidatorMiddleware)
  .use("/api/v1", requireAuth)
  .use("/api/v1", createV1Router())
  .use("/api/github", createGithubRouter())
  .use("/api/trpc", trpcMiddleware);

export { app };
