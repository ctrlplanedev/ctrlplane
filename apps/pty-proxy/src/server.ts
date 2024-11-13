import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import ms from "ms";

const app = express();

// Set the application to trust the reverse proxy
app.set("trust proxy", true);

// Middleware
app.use(cors({ credentials: true }));
app.use(helmet());

app.use(
  rateLimit({
    windowMs: ms("1h"),
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Health check endpoint
app.get("/api/proxy/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

export { app };
