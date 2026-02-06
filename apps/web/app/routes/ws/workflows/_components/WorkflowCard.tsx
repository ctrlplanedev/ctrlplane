import { useWorkflowTemplate } from "./WorkflowTemplateProvider";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { JobStatusBadge } from "../../_components/JobStatusBadge";
import { Dialog, DialogTitle, DialogContent, DialogHeader, DialogTrigger } from "~/components/ui/dialog";
import { format } from "date-fns";

function truncateUuid(uuid: string) {
  return uuid.substring(0, 8) + "..."
}

function JobLinks({ metadata }: { metadata: Record<string, string> }) {
  const links: Record<string, string> = metadata["ctrlplane/links"] != null ? JSON.parse(metadata["ctrlplane/links"]) : {};

  return (
    <div className="flex items-center gap-1.5">
      {Object.entries(links).map(([label, url]) => (
        <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400 dark:text-blue-300 hover:underline">
          {label}
        </a>
      ))}
    </div>
  )
}

function JobDetailDialog(
  { job, children }: { job: WorkspaceEngine["schemas"]["Job"], children: React.ReactNode; }
) {
  const { metadata } = job;
  

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{job.id}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <span>{job.status}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Links</span>
            <JobLinks metadata={metadata} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">External ID</span>
            <span>{job.externalId != null ? job.externalId : "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Created At</span>
            <span>{format(new Date(job.createdAt), "yyyy-MM-dd HH:mm:ss")}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Completed At</span>
            <span>{job.completedAt != null ? format(new Date(job.completedAt), "yyyy-MM-dd HH:mm:ss") : "-"}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkflowJobJobSection({ job }: { job: WorkspaceEngine["schemas"]["Job"] }) {
  return (
    <JobDetailDialog job={job}>
      <div className="flex items-center justify-between hover:bg-accent p-2 rounded-md cursor-pointer">
        <span className="text-sm font-medium">{truncateUuid(job.id)}</span>
        <JobStatusBadge {...job} />
      </div>
    </JobDetailDialog>
  )
}

type WorkflowJob = WorkspaceEngine["schemas"]["WorkflowJobWithJobs"]
type WorkflowJobCardProps = {
  workflowJob: WorkflowJob;
}

function useWorkflowJobTemplate(workflowJob: WorkflowJob) {
  const { workflowTemplate } = useWorkflowTemplate();
  const { index } = workflowJob;
  if (index >= workflowTemplate.jobs.length) return null;
  return workflowTemplate.jobs[index]
}

export function WorkflowJobCard({ workflowJob }: WorkflowJobCardProps) {
  const { jobs } = workflowJob;

  const workflowJobTemplate = useWorkflowJobTemplate(workflowJob);
  if (workflowJobTemplate == null) return null;

  const { name } = workflowJobTemplate;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {jobs.map((job) => (
          <WorkflowJobJobSection key={job.id} job={job} />
        ))}
      </CardContent>
    </Card>
  )
}