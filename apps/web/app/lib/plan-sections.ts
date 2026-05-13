import yaml from "js-yaml";

export type PlanSection = { name: string; content: string };

const isArgoApplication = (doc: unknown): boolean => {
  const d = doc as { apiVersion?: unknown; kind?: unknown } | null;
  return (
    typeof d?.apiVersion === "string" &&
    d.apiVersion.startsWith("argoproj.io/") &&
    d.kind === "Application"
  );
};

function tryParseYamlStream(stream: string): unknown[] | null {
  try {
    return yaml
      .loadAll(stream)
      .filter(
        (d) =>
          d != null && (typeof d !== "object" || Object.keys(d).length > 0),
      );
  } catch {
    return null;
  }
}

export function extractPlanSections(stream: string): PlanSection[] {
  if (!stream.trim()) return [];

  const docs = tryParseYamlStream(stream);
  if (docs == null) return [{ name: "Rendered Manifests", content: stream }];

  const cr = docs.filter(isArgoApplication);
  const manifests = docs.filter((d) => !isArgoApplication(d));

  return [
    ...(cr.length > 0
      ? [
          {
            name: "Application CR",
            content: cr.map((d) => yaml.dump(d)).join("---\n"),
          },
        ]
      : []),
    ...(manifests.length > 0
      ? [
          {
            name: "Rendered Manifests",
            content: manifests.map((d) => yaml.dump(d)).join("---\n"),
          },
        ]
      : []),
  ];
}

export function unionSectionNames(...streams: string[]): string[] {
  const names = new Set<string>();
  for (const s of streams) {
    for (const sec of extractPlanSections(s)) names.add(sec.name);
  }
  return [...names];
}
