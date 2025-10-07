package store

import (
	"context"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/repository"
)

type UserApprovalRecords struct {
	repo *repository.Repository
}

func NewUserApprovalRecords(store *Store) *UserApprovalRecords {
	return &UserApprovalRecords{
		repo: store.repo,
	}
}

func (u *UserApprovalRecords) Upsert(ctx context.Context, userApprovalRecord *pb.UserApprovalRecord) {
	u.repo.UserApprovalRecords.Set(userApprovalRecord.Key(), userApprovalRecord)
}

func (u *UserApprovalRecords) Get(versionId, userId string) (*pb.UserApprovalRecord, bool) {
	return u.repo.UserApprovalRecords.Get(versionId + userId)
}

func (u *UserApprovalRecords) Remove(key string) {
	u.repo.UserApprovalRecords.Remove(key)
}

func (u *UserApprovalRecords) GetApprovers(versionId string) []string {
	approvers := make([]string, 0)
	for record := range u.repo.UserApprovalRecords.IterBuffered() {
		if record.Val.VersionId == versionId && record.Val.Status == pb.ApprovalStatus_APPROVAL_STATUS_APPROVED {
			approvers = append(approvers, record.Val.UserId)
		}
	}
	return approvers
}
