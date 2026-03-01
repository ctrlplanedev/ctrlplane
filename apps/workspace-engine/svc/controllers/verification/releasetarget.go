package verification

// ReleaseTarget holds the IDs needed to enqueue a desired-release
// reconcile item after a verification completes.
type ReleaseTarget struct {
	WorkspaceID   string
	DeploymentID  string
	EnvironmentID string
	ResourceID    string
}
