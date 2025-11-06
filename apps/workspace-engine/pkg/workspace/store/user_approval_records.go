package store

import (
	"context"
	"sort"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

type UserApprovalRecords struct {
	repo  *repository.InMemoryStore
	store *Store
}

func NewUserApprovalRecords(store *Store) *UserApprovalRecords {
	return &UserApprovalRecords{
		repo:  store.repo,
		store: store,
	}
}

func (u *UserApprovalRecords) Upsert(ctx context.Context, userApprovalRecord *oapi.UserApprovalRecord) {
	u.repo.UserApprovalRecords.Set(userApprovalRecord.Key(), userApprovalRecord)
	u.store.changeset.RecordUpsert(userApprovalRecord)
}

func (u *UserApprovalRecords) Get(versionId, userId string) (*oapi.UserApprovalRecord, bool) {
	return u.repo.UserApprovalRecords.Get(versionId + userId)
}

func (u *UserApprovalRecords) Remove(ctx context.Context, key string) {
	userApprovalRecord, ok := u.repo.UserApprovalRecords.Get(key)
	if !ok || userApprovalRecord == nil {
		return
	}

	u.repo.UserApprovalRecords.Remove(key)
	u.store.changeset.RecordDelete(userApprovalRecord)
}

func (u *UserApprovalRecords) GetApprovers(versionId, environmentId string) []string {
	approvers := make([]string, 0)
	for _, record := range u.repo.UserApprovalRecords.Items() {
		if record.VersionId == versionId && record.EnvironmentId == environmentId && record.Status == oapi.ApprovalStatusApproved {
			approvers = append(approvers, record.UserId)
		}
	}
	return approvers
}

func (u *UserApprovalRecords) GetApprovalRecords(versionId, environmentId string) []*oapi.UserApprovalRecord {
	records := make([]*oapi.UserApprovalRecord, 0)
	for _, record := range u.repo.UserApprovalRecords.Items() {
		if record.VersionId == versionId && record.EnvironmentId == environmentId && record.Status == oapi.ApprovalStatusApproved {
			records = append(records, record)
		}
	}
	sort.Slice(records, func(i, j int) bool {
		ti, ei := time.Parse(time.RFC3339, records[i].CreatedAt)
		tj, ej := time.Parse(time.RFC3339, records[j].CreatedAt)
		if ei != nil || ej != nil {
			return records[i].CreatedAt < records[j].CreatedAt
		}
		return ti.Before(tj)
	})
	return records
}
