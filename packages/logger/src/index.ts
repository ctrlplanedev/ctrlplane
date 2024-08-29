import colors from "@colors/colors/safe.js";
import * as winston from "winston";

const { LOG_LEVEL, NODE_ENV } = process.env;

function createLogger(level: string) {
  const format = [
    winston.format.timestamp(),
    winston.format.align(),
    winston.format.printf((info) => {
      const { timestamp, level, message, durationMs } = info;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const ts = timestamp?.slice(0, 19).replace("T", " ");
      const duration = durationMs != null ? `(Timer: ${durationMs}ms)` : "";
      const hasLabel = info.label != null;
      const appendLabel = info.label?.length < 5 ? "    " : "";
      const label = hasLabel ? `\t[${info.label}]${appendLabel} ` : "\t\t";

      return NODE_ENV === "production"
        ? `${ts} ${duration} [${level}]: ${label} ${message} ${duration}`
        : `[${level}]: ${colors.gray(label)}${message} ${duration}`;
    }),
  ];

  // We dont want colors in production. They do not display correctly in cloud run console.
  if (NODE_ENV !== "production") format.unshift(winston.format.colorize());

  return winston.createLogger({
    level,
    format: winston.format.combine(...format),
    transports: [new winston.transports.Console()],
  });
}

export const logger = createLogger(LOG_LEVEL ?? "verbose");
