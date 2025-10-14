package creators

import (
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

// NewUserApprovalRecord creates a test UserApprovalRecord with sensible defaults
// All fields can be overridden directly after creation
func NewUserApprovalRecord(versionId, environmentId, userId string) *oapi.UserApprovalRecord {
	return &oapi.UserApprovalRecord{
		VersionId:     versionId,
		EnvironmentId: environmentId,
		UserId:        userId,
		Status:        oapi.ApprovalStatusApproved,
		Reason:        nil,
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
}

// NewUserID generates a new UUID for test users
func NewUserID() string {
	return uuid.New().String()
}
