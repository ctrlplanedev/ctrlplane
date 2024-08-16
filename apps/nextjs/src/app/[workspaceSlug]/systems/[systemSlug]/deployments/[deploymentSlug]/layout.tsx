import { DeploymentsNavBar } from "./DeploymentNavBar";

export default function DeploymentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DeploymentsNavBar />
      {children}
    </>
  );
}
