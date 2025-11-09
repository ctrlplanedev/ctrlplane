package deploymentversions

import (
	"strings"
	"workspace-engine/pkg/oapi"
)

func compareReleaseTargets(a *fullReleaseTarget, b *fullReleaseTarget) int {
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

	if statusA != nil && statusB != nil {
		if *statusA == oapi.Failure && *statusB != oapi.Failure {
			return -1
		}
		if *statusA != oapi.Failure && *statusB == oapi.Failure {
			return 1
		}

		if *statusA != *statusB {
			return strings.Compare(string(*statusA), string(*statusB))
		}
	}

	var createdAtA, createdAtB int64
	if len(a.Jobs) > 0 {
		createdAtA = a.Jobs[0].CreatedAt.Unix()
	}
	if len(b.Jobs) > 0 {
		createdAtB = b.Jobs[0].CreatedAt.Unix()
	}

	if createdAtA != createdAtB {
		return int(createdAtB - createdAtA)
	}

	return strings.Compare(a.Resource.Name, b.Resource.Name)
}
