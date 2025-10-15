import { makeWithSpan, trace } from "@ctrlplane/logger";

const tracer = trace.getTracer("events");
export const { createSpanWrapper } = makeWithSpan(tracer);
