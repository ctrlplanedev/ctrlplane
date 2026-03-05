package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type UserApprovalRecordRepo struct {
	dbRepo *db.DBRepo
	mem    repository.UserApprovalRecordRepo
}

func NewUserApprovalRecordRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *UserApprovalRecordRepo {
	return &UserApprovalRecordRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.UserApprovalRecords(),
	}
}

func (r *UserApprovalRecordRepo) Get(key string) (*oapi.UserApprovalRecord, bool) {
	return r.mem.Get(key)
}

func (r *UserApprovalRecordRepo) GetApprovedByVersionAndEnvironment(versionID, environmentID string) ([]*oapi.UserApprovalRecord, error) {
	return r.mem.GetApprovedByVersionAndEnvironment(versionID, environmentID)
}

func (r *UserApprovalRecordRepo) Set(entity *oapi.UserApprovalRecord) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.UserApprovalRecords().Set(entity)
}

func (r *UserApprovalRecordRepo) Remove(key string) error {
	if err := r.mem.Remove(key); err != nil {
		return err
	}
	return r.dbRepo.UserApprovalRecords().Remove(key)
}

func (r *UserApprovalRecordRepo) Items() map[string]*oapi.UserApprovalRecord {
	return r.mem.Items()
}
