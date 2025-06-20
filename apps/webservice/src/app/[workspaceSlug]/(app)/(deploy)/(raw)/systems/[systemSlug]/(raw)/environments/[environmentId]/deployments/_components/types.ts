export type Version = {
  id: string;
  tag: string;
};

export type DeploymentStat = {
  deployment: { id: string; name: string; slug: string; version: Version };
  status: "pending" | "failed" | "deploying" | "success";
  resourceCount: number;
  duration: number;
  deployedBy: string | null;
  successRate: number;
  deployedAt: Date;
};

export type StatusFilter =
  | "pending"
  | "failed"
  | "deploying"
  | "success"
  | "all";
