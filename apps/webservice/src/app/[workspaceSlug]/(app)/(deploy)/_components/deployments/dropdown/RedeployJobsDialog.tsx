import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconAlertTriangle } from "@tabler/icons-react";

import { Alert, AlertDescription, AlertTitle } from "@ctrlplane/ui/alert";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import { toast } from "@ctrlplane/ui/toast";
import { defaultCondition, JobCondition } from "@ctrlplane/validators/jobs";

import { JobConditionRender } from "~/app/[workspaceSlug]/(app)/_components/job/condition/JobConditionRender";
import { api } from "~/trpc/react";

export const RedeployJobsDialog: React.FC<{
  deploymentId: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ deploymentId, onClose, children }) => {
  const [open, setOpen] = useState(false);
  const [jobSelector, setJobSelector] =
    useState<JobCondition>(defaultCondition);
  const router = useRouter();

  const redeployJobs =
    api.deployment.version.deploy.allJobsInDeployment.useMutation();

  const handleRedeploy = () =>
    redeployJobs
      .mutateAsync({ deploymentId, jobSelector })
      .then(() => {
        toast.success("Jobs redeployed successfully");
        router.refresh();
        setOpen(false);
        onClose();
      })
      .catch((error) => {
        toast.error("Failed to redeploy jobs");
        console.error(error);
      });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="min-w-[1000px]">
        <DialogHeader>
          <DialogTitle>Redeploy Jobs</DialogTitle>
        </DialogHeader>

        <Alert variant="warning">
          <IconAlertTriangle className="h-5 w-5" />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>
            Redeploying jobs will cancel any existing jobs that are pending or
            in progress, and will redeploy across all environments. Please
            verify the job selector before proceeding and ensure this action is
            intended.
          </AlertDescription>
        </Alert>

        <span className="text-sm text-muted-foreground">
          Select the jobs you want to redeploy, or leave blank to redeploy all
          jobs.
        </span>
        <JobConditionRender
          condition={jobSelector}
          onChange={(c) => setJobSelector(c)}
        />
        <div className="flex justify-end">
          <Button onClick={handleRedeploy} className="w-fit">
            Redeploy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
