import { SpanStatusCode, trace } from "@opentelemetry/api";

import { makeWithSpan } from "@ctrlplane/logger";

export const eventsTracer = trace.getTracer("ctrlplane.events");

/**
 * Get the current active span from the OpenTelemetry context
 * This can be called from within any function that's running inside a traced context
 */
export function getCurrentSpan() {
  return trace.getActiveSpan();
}

export const { createSpanWrapper, wrapFnWithSpan } = makeWithSpan(eventsTracer);

export function Trace(name?: string): MethodDecorator {
  return (_target, propertyKey, descriptor: PropertyDescriptor) => {
    const original = descriptor.value as ((...args: any[]) => any) | undefined;
    if (!original) return descriptor;

    descriptor.value = function (...args: any[]) {
      return eventsTracer.startActiveSpan(
        name ?? String(propertyKey),
        (span) => {
          try {
            const result = original.apply(this, args);
            if (result != null && typeof result.then === "function") {
              return (result as Promise<unknown>)
                .catch((err: unknown) => {
                  span.recordException(
                    err instanceof Error ? err : new Error(String(err)),
                  );
                  span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: String(err),
                  });
                  throw err;
                })
                .finally(() => span.end());
            }
            span.end();
            return result;
          } catch (err) {
            span.recordException(err as Error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: String(err),
            });
            span.end();
            throw err;
          }
        },
      );
    };

    return descriptor;
  };
}
