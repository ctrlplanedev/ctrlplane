package manager

import "workspace-engine/pkg/workspace/status"

// StatusTracker returns the global status tracker
func StatusTracker() *status.Tracker {
	return status.Global()
}

