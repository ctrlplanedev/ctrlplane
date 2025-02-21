import React from "react";
import { capitalCase } from "change-case";
import { format } from "date-fns";

import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { JobStatusReadable } from "@ctrlplane/validators/jobs";

import type { Job } from "./Job";
import { JobTableStatusIcon } from "../JobTableStatusIcon";

type JobPropertiesTableProps = { job: Job };

export const JobPropertiesTable: React.FC<JobPropertiesTableProps> = ({
  job,
}) => {
  const linksMetadata = job.job.metadata[ReservedMetadataKey.Links];

  const links =
    linksMetadata != null
      ? (JSON.parse(linksMetadata) as Record<string, string>)
      : null;

  return (
    <div className="space-y-2">
      <div className="text-sm">Properties</div>
      <table width="100%" className="table-fixed text-xs">
        <tbody>
          <tr>
            <td className="w-[110px] p-1 pr-2 text-muted-foreground">
              Job Status
            </td>
            <td>
              <div className="flex items-center gap-2">
                <JobTableStatusIcon
                  status={job.job.status}
                  className="h-3 w-3"
                />
                {JobStatusReadable[job.job.status]}
              </div>
            </td>
          </tr>
          <tr>
            <td className="w-[110px] p-1 pr-2 text-muted-foreground">
              Environment
            </td>
            <td>{job.environment.name}</td>
          </tr>
          <tr>
            <td className="w-[110px] p-1 pr-2 text-muted-foreground">
              Deployment
            </td>
            <td>{capitalCase(job.release.deployment.name)}</td>
          </tr>
          <tr>
            <td className="w-[110px] p-1 pr-2 text-muted-foreground">
              Release
            </td>
            <td>{job.release.name}</td>
          </tr>
          {job.causedBy != null && (
            <tr>
              <td className="w-[110px] p-1 pr-2 text-muted-foreground">
                Caused by
              </td>
              <td>{job.causedBy.name}</td>
            </tr>
          )}
          <tr>
            <td className="w-[110px] p-1 pr-2 text-muted-foreground">
              Created at
            </td>
            <td>{format(job.job.createdAt, "MMM d, yyyy 'at' h:mm a")}</td>
          </tr>

          <tr>
            <td className="w-[110px] p-1 pr-2 text-muted-foreground">
              Updated at
            </td>
            <td>{format(job.job.updatedAt, "MMM d, yyyy 'at' h:mm a")}</td>
          </tr>

          <tr>
            <td className="p-1 pr-2 align-top text-muted-foreground">Links</td>
            <td>
              {links == null ? (
                <span className="cursor-help italic text-gray-500">
                  Not set
                </span>
              ) : (
                <div className="pt-1">
                  {Object.entries(links).map(([name, url]) => (
                    <a
                      key={name}
                      referrerPolicy="no-referrer"
                      href={url}
                      className="inline-block w-full overflow-hidden text-ellipsis text-nowrap text-blue-300 hover:text-blue-400"
                    >
                      {name}
                    </a>
                  ))}
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
