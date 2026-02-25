package store

import (
	"context"
	"sort"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
)

type UserApprovalRecords struct {
	repo  repository.UserApprovalRecordRepo
	store *Store
}

func NewUserApprovalRecords(store *Store) *UserApprovalRecords {
	return &UserApprovalRecords{
		repo:  store.repo.UserApprovalRecords(),
		store: store,
	}
}

func (u *UserApprovalRecords) SetRepo(repo repository.UserApprovalRecordRepo) {
	u.repo = repo
}

func (u *UserApprovalRecords) Upsert(ctx context.Context, userApprovalRecord *oapi.UserApprovalRecord) {
	if err := u.repo.Set(userApprovalRecord); err != nil {
		log.Error("Failed to upsert user approval record", "error", err)
		return
	}
	u.store.changeset.RecordUpsert(userApprovalRecord)
}

func (u *UserApprovalRecords) Get(versionId, userId, environmentId string) (*oapi.UserApprovalRecord, bool) {
	return u.repo.Get(versionId + userId + environmentId)
}

func (u *UserApprovalRecords) Remove(ctx context.Context, key string) {
	userApprovalRecord, ok := u.repo.Get(key)
	if !ok || userApprovalRecord == nil {
		return
	}

	if err := u.repo.Remove(key); err != nil {
		log.Error("Failed to remove user approval record", "error", err)
		return
	}
	u.store.changeset.RecordDelete(userApprovalRecord)
}

func (u *UserApprovalRecords) GetApprovers(versionId, environmentId string) []string {
	records, err := u.repo.GetApprovedByVersionAndEnvironment(versionId, environmentId)
	if err != nil {
		log.Warn("Failed to get approvers", "version_id", versionId, "environment_id", environmentId, "error", err)
		return nil
	}
	approvers := make([]string, len(records))
	for i, r := range records {
		approvers[i] = r.UserId
	}
	return approvers
}

func (u *UserApprovalRecords) GetApprovalRecords(versionId, environmentId string) []*oapi.UserApprovalRecord {
	records, err := u.repo.GetApprovedByVersionAndEnvironment(versionId, environmentId)
	if err != nil {
		log.Warn("Failed to get approval records", "version_id", versionId, "environment_id", environmentId, "error", err)
		return nil
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
