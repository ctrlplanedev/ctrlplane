"use client";

import { Card } from "@ctrlplane/ui/card";

import { api } from "~/trpc/react";

export const JobsContent: React.FC<{ targetId: string }> = ({ targetId }) => {
  const jobs = api.job.byTargetId.useQuery(targetId);
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
