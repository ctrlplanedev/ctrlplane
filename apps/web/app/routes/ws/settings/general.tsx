import { DomainMatchingCard } from "./_components/domain-matching/DomainMatchingCard";
import { WorkspaceInfoCard } from "./_components/workspace-info/WorkspaceInfoCard";

export default function GeneralSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">General Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your workspace settings
        </p>
      </div>

      <WorkspaceInfoCard />
      <DomainMatchingCard />
    </div>
  );
}
