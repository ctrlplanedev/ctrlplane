export enum HealthStatus {
  Healthy = "Healthy",
  IssuesDetected = "Issues Detected",
  NoResources = "No Resources",
}

export const getHealthStatus = (unhealthyCount: number, totalCount: number) => {
  if (totalCount === 0) return HealthStatus.NoResources;
  if (unhealthyCount === 0) return HealthStatus.Healthy;
  return HealthStatus.IssuesDetected;
};

export const getStatusBackgroundColor = (healthStatus: HealthStatus) => {
  if (healthStatus === HealthStatus.Healthy) return "bg-green-500/20";
  if (healthStatus === HealthStatus.IssuesDetected) return "bg-red-500/20";
  return "bg-neutral-500/20";
};

export const getStatusTextColor = (healthStatus: HealthStatus) => {
  if (healthStatus === HealthStatus.Healthy) return "text-green-400";
  if (healthStatus === HealthStatus.IssuesDetected) return "text-red-400";
  return "text-neutral-400";
};
