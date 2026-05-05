import type { Counter } from "@opentelemetry/api";
import type { Request, RequestHandler } from "express";
import { metrics } from "@opentelemetry/api";

const BROWSER_MATCHERS: Array<{ test: (ua: string) => boolean; name: string }> =
  [
    // Order matters: Edge / Opera UAs include "Chrome/" too, so they go first.
    { test: (ua) => ua.includes("Edg/") || ua.includes("Edge/"), name: "Edge" },
    {
      test: (ua) => ua.includes("OPR/") || ua.includes("Opera/"),
      name: "Opera",
    },
    { test: (ua) => ua.includes("Chrome/"), name: "Chrome" },
    { test: (ua) => ua.includes("Firefox/"), name: "Firefox" },
    // Safari last: every WebKit-based browser includes "Safari/" in its UA.
    {
      test: (ua) => ua.startsWith("Mozilla/") && ua.includes("Safari/"),
      name: "Safari",
    },
  ];

export const simplifyUserAgent = (
  userAgent: string | string[] | undefined | null,
): string => {
  const ua = Array.isArray(userAgent) ? userAgent[0] : userAgent;
  if (!ua || ua.trim() === "") return "unknown";
  const trimmed = ua.trim();

  for (const { test, name } of BROWSER_MATCHERS) {
    if (test(trimmed)) return name;
  }

  // Generic "Mozilla/..." UA we don't recognize — still a browser-shape.
  if (trimmed.startsWith("Mozilla/")) return "browser-other";

  // Most non-browser clients use the form "name/version ..." (curl, axios,
  // okhttp, python-requests, our own SDK, etc.) — extract the leading product.
  const firstToken = trimmed.split(/[/\s]/, 1)[0];
  if (firstToken && /^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(firstToken)) {
    return firstToken.toLowerCase();
  }

  return "other";
};

const resolveRouteTemplate = (req: Request): string => {
  const template = req.route?.path;
  if (template == null) return "unmatched";
  return `${req.baseUrl}${typeof template === "string" ? template : String(template)}`;
};

let counter: Counter | null = null;
const getCounter = (): Counter => {
  if (counter) return counter;
  counter = metrics
    .getMeter("ctrlplane-api")
    .createCounter("http.server.requests_by_client", {
      description:
        "Number of HTTP requests received, labeled by simplified client (User-Agent)",
    });
  return counter;
};

export const metricsMiddleware: RequestHandler = (req, res, next) => {
  res.on("finish", () => {
    getCounter().add(1, {
      client: simplifyUserAgent(req.headers["user-agent"]),
      method: req.method,
      status_code: String(res.statusCode),
      route: resolveRouteTemplate(req),
    });
  });
  next();
};
