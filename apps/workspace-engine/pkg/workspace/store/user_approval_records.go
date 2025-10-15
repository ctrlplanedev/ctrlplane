package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
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

func (u *UserApprovalRecords) Upsert(ctx context.Context, userApprovalRecord *oapi.UserApprovalRecord) {
	u.repo.UserApprovalRecords.Set(userApprovalRecord.Key(), userApprovalRecord)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeCreate, userApprovalRecord)
	}
}

func (u *UserApprovalRecords) Get(versionId, userId string) (*oapi.UserApprovalRecord, bool) {
	return u.repo.UserApprovalRecords.Get(versionId + userId)
}

func (u *UserApprovalRecords) Remove(ctx context.Context, key string) {
	userApprovalRecord, ok := u.repo.UserApprovalRecords.Get(key)
	if !ok {
		return
	}

	u.repo.UserApprovalRecords.Remove(key)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeDelete, userApprovalRecord)
	}
}

func (u *UserApprovalRecords) GetApprovers(versionId string) []string {
	approvers := make([]string, 0)
	for record := range u.repo.UserApprovalRecords.IterBuffered() {
		if record.Val.VersionId == versionId && record.Val.Status == oapi.ApprovalStatusApproved {
			approvers = append(approvers, record.Val.UserId)
		}
	}
	return approvers
}
