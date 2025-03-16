import * as yaml from "js-yaml";

import type { Job } from "./Job";
import { ConfigEditor } from "../../ConfigEditor";

type JobAgentProps = {
  job: Job;
};

export const JobAgent: React.FC<JobAgentProps> = ({ job }) => (
  <div className="space-y-2">
    <div className="text-sm">Agent</div>
    <table width="100%" className="table-fixed text-xs">
      <tbody>
        <tr>
          <td className="w-[110px] p-1 pr-2 text-muted-foreground">Name</td>
          <td>{job.jobAgent.name}</td>
        </tr>
        <tr>
          <td className="w-[110px] p-1 pr-2 text-muted-foreground">Type</td>
          <td>{job.jobAgent.type}</td>
        </tr>
        <tr>
          <td className="w-[110px] p-1 pr-2 align-top text-muted-foreground">
            Job Config
          </td>
          <td />
        </tr>
      </tbody>
    </table>
    <div className="scrollbar-none max-h-[250px] overflow-auto">
      <ConfigEditor value={yaml.dump(job.job.jobAgentConfig)} readOnly />
    </div>
  </div>
);
