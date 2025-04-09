import React from "react";

export const QualitySecurity: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Quality & Security Rules</h2>
      <div className="space-y-4">
        <div>
          <h3 className="text-md font-medium">Success Rate Required</h3>
          <p className="text-sm text-muted-foreground">
            Require minimum success rate before proceeding
          </p>
        </div>
        <div>
          <h3 className="text-md font-medium">Release Dependency</h3>
          <p className="text-sm text-muted-foreground">
            Enforce dependencies between deployments
          </p>
        </div>
        <div>
          <h3 className="text-md font-medium">Approval Gate</h3>
          <p className="text-sm text-muted-foreground">
            Require manual approval before deployment
          </p>
        </div>
      </div>
    </div>
  );
};
