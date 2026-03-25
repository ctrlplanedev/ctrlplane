const sensitiveKeys = new Set(["token", "apiKey", "secret"]);

export function ConfigEntry({
  entryKey,
  value,
  className,
}: {
  entryKey: string;
  value: unknown;
  className?: string;
}) {
  const isSensitive = sensitiveKeys.has(entryKey);
  return (
    <div
      className={`flex items-start gap-2 font-mono font-semibold ${className ?? ""}`}
    >
      <span className="shrink-0 text-red-600">{entryKey}:</span>
      <pre className="text-green-700">
        {isSensitive
          ? "[REDACTED]"
          : typeof value === "string"
            ? value
            : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
