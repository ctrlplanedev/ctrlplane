import type { RouterOutputs } from "@ctrlplane/api";
import _ from "lodash";

type Resource =
  RouterOutputs["resource"]["byWorkspaceId"]["list"]["items"][number];

const baseFields = [
  "id",
  "resourceName",
  "kind",
  "identifier",
  "version",
  "provider",
  "createdAt",
  "updatedAt",
];

const resourceArrayToCsv = (
  resourceData: Record<string, string>[],
  metadataKeys: string[],
) => {
  const headers = [...baseFields, ...metadataKeys];
  const headerRow = headers
    .map((v) => v.replaceAll('"', '""'))
    .map((v) => `"${v}"`)
    .join(",");

  const dataRows = resourceData.map((row) =>
    headers
      .map((key) => row[key] ?? "")
      .map((v) => v.replaceAll('"', '""'))
      .map((v) => `"${v}"`)
      .join(","),
  );

  return [headerRow, ...dataRows].join("\r\n");
};

export const exportResources = (resources: Resource[]) => {
  const metadataKeys = Array.from(
    new Set(resources.flatMap((r) => Object.keys(r.metadata))),
  );
  const rows: Record<string, string>[] = resources.map((resource) => ({
    id: resource.id,
    resourceName: resource.name,
    kind: resource.kind,
    identifier: resource.identifier,
    version: resource.version,
    provider: resource.provider?.name ?? "",
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt?.toISOString() ?? "",
    ..._.zipObject(
      metadataKeys,
      metadataKeys.map((key) => resource.metadata[key] ?? ""),
    ),
  }));

  const csv = resourceArrayToCsv(rows, metadataKeys);

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url });
  link.setAttribute("download", "resources.csv");
  link.click();
};
