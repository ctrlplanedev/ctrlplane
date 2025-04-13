import { trace } from "@opentelemetry/api";

import { makeWithSpan } from "../../utils/spans.js";

const tracer = trace.getTracer("updated-resource");
export const withSpan = makeWithSpan(tracer);
