package deploymentversions

import (
	"strings"
	"workspace-engine/pkg/oapi"
)

func compareReleaseTargets(a *fullReleaseTarget, b *fullReleaseTarget) int {
	// Get the first job status from both
	var statusA *oapi.JobStatus
	var statusB *oapi.JobStatus

	if len(a.Jobs) > 0 {
		statusA = &a.Jobs[0].Status
	}
	if len(b.Jobs) > 0 {
		statusB = &b.Jobs[0].Status
	}

	// Handle nil status cases
	if statusA == nil && statusB != nil {
		return 1
	}
	if statusA != nil && statusB == nil {
		return -1
	}

	// If both statuses exist, compare them
	if statusA != nil && statusB != nil {
		// Prioritize failures - they should come first
		if *statusA == oapi.Failure && *statusB != oapi.Failure {
			return -1
		}
		if *statusA != oapi.Failure && *statusB == oapi.Failure {
			return 1
		}

		// If statuses are different, compare lexicographically
		if *statusA != *statusB {
			return strings.Compare(string(*statusA), string(*statusB))
		}
	}

	// Compare createdAt times (most recent first)
	var createdAtA, createdAtB int64
	if len(a.Jobs) > 0 {
		createdAtA = a.Jobs[0].CreatedAt.Unix()
	}
	if len(b.Jobs) > 0 {
		createdAtB = b.Jobs[0].CreatedAt.Unix()
	}

	if createdAtA != createdAtB {
		// Return negative if b is more recent (b should come first)
		return int(createdAtB - createdAtA)
	}

	// Finally, compare resource names
	return strings.Compare(a.Resource.Name, b.Resource.Name)
}
