import { ExpressAuth } from "@auth/express";
import GitHub from "@auth/express/providers/github";
import * as trpcExpress from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { appRouter, createTRPCContext } from "@ctrlplane/api";

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

app.use(
  "/api/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: ({ req }) =>
      createTRPCContext({
        session: req.session,
        headers: new Headers(req.headers as any),
      }),
  }),
);

// Health check endpoint
app.get("/api/v1", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// OpenAPI routes (if you add any paths to openapi.json, they'll be handled here)
// const api = new OpenAPIBackend({ definition: "./openapi/openapi.json" });
// api.register({});
// api.init();
// app.use("/api/v1", (req, res) => api.handleRequest(req as any, req as any, res));

export { app };
