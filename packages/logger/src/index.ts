import colors from "@colors/colors/safe.js";
import { OpenTelemetryTransportV3 } from "@opentelemetry/winston-transport";
import * as winston from "winston";

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
