import { ExpressAuth } from "@auth/express";
import GitHub from "@auth/express/providers/github";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

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
app.use("/api/auth/*", ExpressAuth({ providers: [GitHub] }));

// Health check endpoint
app.get("/api/v1", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

export { app };
