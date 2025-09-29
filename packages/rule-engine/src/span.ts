import { makeWithSpan, trace } from "@ctrlplane/logger";

const tracer = trace.getTracer("rule-engine");

export const { createSpanWrapper } = makeWithSpan(tracer);
