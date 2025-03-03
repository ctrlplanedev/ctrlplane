export default function EnvironmentConfigPage() {
  return (
    <div className="pt-4">
      <div className="flex gap-10">
        <div className="w-[200px] shrink-0 space-y-2 text-sm text-muted-foreground">
          <div>
            <a href="#deployment-controls">Deployment Controls</a>
          </div>
          <div>
            <a href="#approval-governance">Approval & Governance</a>
          </div>
          <div>
            <a href="#release-management">Release Management</a>
          </div>
          <div>
            <a href="#release-channels">Release Channels</a>
          </div>
          <div>Rollout & Timing</div>
        </div>
        <div className="max-w-[600px] space-y-6">
          <div>
            <h2 id="approval-governance" className="font-bold">
              Approval & Governance
            </h2>
          </div>
          <div>
            <h2 id="deployment-controls" className="font-bold">
              Deployment Controls
            </h2>
          </div>
          <div>
            <h2 id="release-management" className="font-bold">
              Release Management
            </h2>
          </div>
          <div>
            <h2 id="release-channels" className="font-bold">
              Release Channels
            </h2>
          </div>
          <div>
            <h2 id="rollout-timing" className="font-bold">
              Rollout & Timing
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
}
