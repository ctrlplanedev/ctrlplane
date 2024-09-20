import { TbTopologyComplex } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";

export const TargetGettingStarted: React.FC = () => {
  return (
    <div className="h-full w-full p-20">
      <div className="container m-auto max-w-xl space-y-6 p-20">
        <div className="relative -ml-1 text-neutral-500">
          <TbTopologyComplex className="h-10 w-10" strokeWidth={0.5} />
        </div>
        <div className="font-semibold">Targets</div>
        <div className="prose prose-invert text-sm text-muted-foreground">
          <p>
            Targets are the destinations where your jobs are executed. They can
            represent a wide range of entities, from a traditional
            infrastructure target like an EKS cluster to a more abstract target
            like a Salesforce account.
          </p>
          <p>
            To keep the status of targets up-to-date, they should be created by
            providers. You can then attach metadata to these targets, allowing
            Environments to easily filter and include them in specific
            workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm">Register Target</Button>
          <Button size="sm" variant="secondary">
            Documentation
          </Button>
        </div>
      </div>
    </div>
  );
};
