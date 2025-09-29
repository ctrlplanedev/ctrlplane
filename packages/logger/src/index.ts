import type { Span, Tracer } from "@opentelemetry/api";
import colors from "@colors/colors/safe.js";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { OpenTelemetryTransportV3 } from "@opentelemetry/winston-transport";
import * as winston from "winston";

/**
 * Logger utilities integrated with OpenTelemetry and Winston.
 * Provides a configured `logger` and helpers to wrap functions/spans.
 */
/** Re-export commonly used OpenTelemetry types and helpers. */
export { trace, Tracer, Span, SpanStatusCode };

const { LOG_LEVEL, NODE_ENV } = process.env;

/**
 * Create a Winston logger configured with console and OpenTelemetry transports.
 *
 * - Colorized, timestamped format for non-production; compact JSON-like for production.
 *
 * @param level - Minimum log level (e.g. "error", "warn", "info", "verbose", "debug", "silly").
 * @returns Configured Winston logger instance.
 */
function createLogger(level: string) {
  const format = [
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.align(),
    winston.format.printf((info: winston.Logform.TransformableInfo) => {
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

/**
 * Shared application logger.
 *
 * Level defaults to `LOG_LEVEL` env var or "verbose".
 */
export const logger = createLogger(LOG_LEVEL ?? "verbose");

/**
 * Factory for span helpers bound to a specific OpenTelemetry tracer.
 *
 * Provides:
 * - `createSpanWrapper`: Wraps async/sync functions to run inside a named span with error status handling.
 * - `wrapFnWithSpan`: Convenience wrapper preserving original function signature.
 *
 * @param tracer - OpenTelemetry tracer to start spans on.
 * @returns Helpers to create span-wrapped functions.
 */
export function makeWithSpan(tracer: Tracer) {
  /**
   * Wrap a function so it runs inside an active OpenTelemetry span.
   *
   * The span is ended automatically and marked as error if the function throws.
   *
   * @typeParam T - Tuple of argument types of the wrapped function.
   * @typeParam R - Return type of the wrapped function.
   * @param name - Span name.
   * @param fn - Function to execute within the span. Receives the span as first argument.
   * @returns A function that, when called, starts the span and returns a Promise of the original result.
   */
  function createSpanWrapper<T extends any[], R>(
    name: string,
    fn: (span: Span, ...args: T) => Promise<R> | R,
  ): (...args: T) => Promise<R> {
    return async function spanWrappedFunction(...args: T): Promise<R> {
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
  }

  /**
   * Convenience wrapper around `createSpanWrapper` that preserves the target function's signature.
   *
   * @param name - Span name.
   * @param fn - Function to execute within the span.
   * @returns A Promise-returning function mirroring `fn`'s parameters and return type.
   */
  function wrapFnWithSpan<T extends (...args: any[]) => any>(
    name: string,
    fn: T,
  ): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    return (...args: Parameters<T>) => createSpanWrapper(name, fn)(...args);
  }

  return { createSpanWrapper, wrapFnWithSpan };
}
