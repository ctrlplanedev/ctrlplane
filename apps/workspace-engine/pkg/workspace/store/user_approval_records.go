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