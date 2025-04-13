import type { Span, Tracer } from "@opentelemetry/api";
import { SpanStatusCode } from "@opentelemetry/api";

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
