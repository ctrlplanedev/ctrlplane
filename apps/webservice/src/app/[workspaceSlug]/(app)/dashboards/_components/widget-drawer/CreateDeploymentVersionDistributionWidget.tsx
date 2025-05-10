import type React from "react";

import { useForm } from "@ctrlplane/ui/form";

import { schema } from "../../[dashboardId]/_components/widgets/WidgetDeploymentVersionDistribution";

export const CreateDeploymentVersionDistributionWidget: React.FC<{
  workspaceId: string;
}> = ({ workspaceId }) => {
  const form = useForm({
    schema,
    defaultValues: { deploymentId: "", environmentIds: [] },
  });
};
