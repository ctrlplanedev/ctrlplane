"use client";

import { Card } from "@ctrlplane/ui/card";

import { api } from "~/trpc/react";

export const JobsContent: React.FC<{ resourceId: string }> = ({
  resourceId,
}) => {
  const jobs = api.job.byResourceId.useQuery(resourceId);
  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm">
        <div>History</div>
        <Card className="px-3 py-2">
          {jobs.data?.map((t) => (
            <div key={t.id}>
              {t.job.id} / {t.job.status}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};
