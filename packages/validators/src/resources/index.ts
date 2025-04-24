export * from "./kubernetes-v1.js";
export * from "./conditions/index.js";
export * from "./cloud-v1.js";
export * from "./compute-v1.js";
export * from "./cloud-geo.js";

export const versions = [
  "compute.ctrlplane.dev/v1",
  "cloud.ctrlplane.dev/v1",
  "k8s.ctrlplane.dev/v1",
  "location.ctrlplane.dev/v1",
] as const;
