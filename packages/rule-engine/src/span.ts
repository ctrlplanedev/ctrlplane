import type { Span, Tracer } from "@opentelemetry/api";
import { SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("rule-engine");

function makeWithSpan(tracer: Tracer) {
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

export const withSpan = makeWithSpan(tracer);
