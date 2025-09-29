import { makeWithSpan, trace } from "@ctrlplane/logger";

const tracer = trace.getTracer("updated-resource");
export const { createSpanWrapper } = makeWithSpan(tracer);
