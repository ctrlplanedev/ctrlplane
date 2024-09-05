import { GoogleIntegration } from "./GoogleIntegration";

export const metadata = { title: "Google Integrations - Settings" };

export default function GoogleIntegrationPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  return <GoogleIntegration workspaceSlug={params.workspaceSlug} />;
}
