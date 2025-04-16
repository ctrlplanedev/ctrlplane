import type { Span, Tracer } from "@opentelemetry/api";
import colors from "@colors/colors/safe.js";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { OpenTelemetryTransportV3 } from "@opentelemetry/winston-transport";
import * as winston from "winston";

export { trace, Tracer, Span, SpanStatusCode };

const { LOG_LEVEL, NODE_ENV } = process.env;

function createLogger(level: string) {
  const format = [
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.align(),
    winston.format.printf((info) => {
      const { timestamp, level, message, durationMs, label, ...other } =
        info as {
          timestamp: string | undefined;
          durationMs: number | undefined;
          label: string | undefined;
          level: string;
          message: string;
        };

      const ts = timestamp?.slice(0, 19).replace("T", " ");
      const duration = durationMs != null ? `(${durationMs}ms)` : "";
      const hasLabel = label != null && label !== "";
      const appendLabel = hasLabel && label.length < 5 ? "    " : "";
      const labelPrint = hasLabel ? `\t[${label}]${appendLabel} ` : "\t";

      return NODE_ENV === "production"
        ? `${ts} [${level}]: ${labelPrint} ${message} ${duration} [${JSON.stringify(other)}]`
        : `[${level}]: ${colors.gray(labelPrint)}${message} ${duration} [${JSON.stringify(other)}]`;
    }),
  ];

  return winston.createLogger({
    level,
    format: winston.format.combine(...format),
    transports: [
      new winston.transports.Console(),
      new OpenTelemetryTransportV3(),
    ],
  });
}

export const logger = createLogger(LOG_LEVEL ?? "verbose");

export const withSpan =
  (tracer: Tracer) =>
  async <T>(
    name: string,
    operation: (span: Span) => Promise<T>,
    attributes: Record<string, string> = {},
  ): Promise<T> => {
    return tracer.startActiveSpan(name, async (span) => {
      try {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
        const result = await operation(span);
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  };

export function makeWithSpan(tracer: Tracer) {
  return function withSpan<T extends any[], R>(
    name: string,
    fn: (span: Span, ...args: T) => Promise<R> | R,
  ): (...args: T) => Promise<R> {
    return async function wrapped(...args: T): Promise<R> {
      return tracer.startActiveSpan(name, async (span) => {
        try {
          return await fn(span, ...args);
        } catch (err) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (err as Error).message,
          });
          throw err;
        } finally {
          span.end();
        }
      });
    };
  };
}
