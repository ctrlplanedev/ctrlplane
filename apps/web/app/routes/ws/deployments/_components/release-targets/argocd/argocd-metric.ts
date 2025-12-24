import { z } from "zod";

export const argoCDProviderConfig = z.object({
  type: z.literal("http"),
  url: z.string(),
  method: z.string().optional(),
  headers: z.record(z.string()).optional(),
  timeout: z.string().optional(),
});

export type ArgoCDProviderConfig = z.infer<typeof argoCDProviderConfig>;

export function parseArgoCDProvider(
  provider: unknown,
): ArgoCDProviderConfig | null {
  const result = argoCDProviderConfig.safeParse(provider);
  return result.success ? result.data : null;
}

export function getArgoCDAppUrl(
  providerUrl: string,
  namespace: string,
): string {
  return providerUrl.replace(
    "/api/v1/applications/",
    `/applications/${namespace}/`,
  );
}

export const argoCDHealthStatus = z.enum([
  "Healthy",
  "Progressing",
  "Degraded",
  "Suspended",
  "Missing",
  "Unknown",
]);

export const argoCDSyncStatus = z.enum(["Synced", "OutOfSync", "Unknown"]);

export const argoCDOperationPhase = z.enum([
  "Running",
  "Succeeded",
  "Failed",
  "Error",
  "Terminating",
]);

const argoCDApplicationStatus = z.object({
  sync: z
    .object({
      status: z.string().optional(),
      revision: z.string().optional(),
      comparedTo: z
        .object({
          source: z.object({}).passthrough().optional(),
          destination: z.object({}).passthrough().optional(),
        })
        .optional(),
    })
    .optional(),
  health: z
    .object({
      status: z.string().optional(),
    })
    .optional(),
  operationState: z
    .object({
      phase: z.string().optional(),
      message: z.string().optional(),
      startedAt: z.string().optional(),
      finishedAt: z.string().optional(),
      syncResult: z.object({}).passthrough().optional(),
    })
    .optional(),
  reconciledAt: z.string().optional(),
  sourceType: z.string().optional(),
  resources: z.array(z.object({}).passthrough()).optional(),
  summary: z
    .object({
      images: z.array(z.string()).optional(),
    })
    .optional(),
  controllerNamespace: z.string().optional(),
  history: z.array(z.object({}).passthrough()).optional(),
});

const argoCDApplicationMetadata = z.object({
  name: z.string(),
  namespace: z.string(),
  uid: z.string().optional(),
  resourceVersion: z.string().optional(),
  creationTimestamp: z.string().optional(),
  labels: z.record(z.string()).optional(),
});

export const argoCDApplicationJson = z.object({
  metadata: argoCDApplicationMetadata,
  spec: z.object({
    source: z
      .object({
        repoURL: z.string().optional(),
        path: z.string().optional(),
        targetRevision: z.string().optional(),
        helm: z.object({}).passthrough().optional(),
        kustomize: z.object({}).passthrough().optional(),
      })
      .optional(),
    destination: z
      .object({
        name: z.string().optional(),
        namespace: z.string().optional(),
        server: z.string().optional(),
      })
      .optional(),
    project: z.string().optional(),
    syncPolicy: z.object({}).passthrough().optional(),
  }),
  status: argoCDApplicationStatus.optional(),
});

export const argoCDMeasurementData = z.object({
  ok: z.boolean(),
  statusCode: z.number(),
  body: z.string(),
  json: argoCDApplicationJson,
  headers: z.record(z.array(z.string())).optional(),
  duration: z.number().optional(),
});

export type ArgoCDMeasurementData = z.infer<typeof argoCDMeasurementData>;

export type ArgoCDApplicationJson = z.infer<typeof argoCDApplicationJson>;

export function parseArgoCDMeasurement(
  data: unknown,
): ArgoCDMeasurementData | null {
  const result = argoCDMeasurementData.safeParse(data);
  return result.success ? result.data : null;
}

export function isArgoCDMeasurement(data: unknown): boolean {
  return argoCDMeasurementData.safeParse(data).success;
}

export function getArgoCDStatus(data: ArgoCDMeasurementData) {
  const app = data.json;
  const status = app.status;

  return {
    name: app.metadata.name,
    namespace: app.metadata.namespace,
    syncStatus: status?.sync?.status ?? "Unknown",
    healthStatus: status?.health?.status ?? "Unknown",
    operationPhase: status?.operationState?.phase,
    operationMessage: status?.operationState?.message,
    revision: status?.sync?.revision,
    reconciledAt: status?.reconciledAt,
    sourceType: status?.sourceType,
    images: status?.summary?.images,
    resourceCount: status?.resources?.length,
  };
}
