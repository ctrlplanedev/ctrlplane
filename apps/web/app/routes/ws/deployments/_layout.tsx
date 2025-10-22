import { Outlet } from "react-router";

import { DeploymentProvider } from "./_components/DeploymentProvider";

export default function DeploymentsLayout() {
  return (
    <DeploymentProvider>
      <Outlet />
    </DeploymentProvider>
  );
}
