"use client";

import { useEnvironmentVersionApprovalDrawer } from "./useEnvironmentVersionApprovalDrawer";

export const EnvironmentVersionApprovalDrawer: React.FC = () => {
  const {
    environmentId,
    versionId,
    setEnvironmentVersionIds,
    removeEnvironmentVersionIds,
  } = useEnvironmentVersionApprovalDrawer();
  const isOpen = environmentId != null && versionId != null;
};
