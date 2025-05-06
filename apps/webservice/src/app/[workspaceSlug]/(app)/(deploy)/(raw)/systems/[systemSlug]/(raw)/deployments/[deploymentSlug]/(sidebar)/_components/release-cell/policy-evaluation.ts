export type PolicyEvaluationResult = {
  policies: { id: string; name: string }[];
  rules: {
    anyApprovals: Record<string, string[]>;
    roleApprovals: Record<string, string[]>;
    userApprovals: Record<string, string[]>;
    versionSelector: Record<string, boolean>;
  };
};
