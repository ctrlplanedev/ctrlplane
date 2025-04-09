import React from "react";

export const TimeWindows: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Time Window Rules</h2>
      <div className="space-y-4">
        <div>
          <h3 className="text-md font-medium">Deny Window</h3>
          <p className="text-sm text-muted-foreground">
            Prevent deployments during specific time periods
          </p>
        </div>
        <div>
          <h3 className="text-md font-medium">Maintenance Window</h3>
          <p className="text-sm text-muted-foreground">
            Allow deployments only during specified time windows
          </p>
        </div>
      </div>
    </div>
  );
};
