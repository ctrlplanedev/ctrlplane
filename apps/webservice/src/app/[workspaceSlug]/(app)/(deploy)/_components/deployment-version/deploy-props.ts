// Common type for deployment and environment props
export type DeployProps = {
  deployment: { id: string; name: string };
  environment: { id: string; name: string };
  resource?: { id: string; name: string };
  children: React.ReactNode;
};
