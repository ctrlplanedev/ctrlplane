package versionanyapproval

import "time"

type ApprovalRecordStatus string

const (
	ApprovalRecordStatusApproved ApprovalRecordStatus = "approved"
	ApprovalRecordStatusRejected ApprovalRecordStatus = "rejected"
)

type ApprovalRecord interface {
	GetID() string
	GetVersionID() string
	GetEnvironmentID() string
	GetUserID() string
	GetStatus() ApprovalRecordStatus
	GetApprovedAt() *time.Time
	GetReason() *string

	IsApproved() bool
}
