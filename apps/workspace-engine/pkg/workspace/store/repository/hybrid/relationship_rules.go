package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type RelationshipRuleRepo struct {
	dbRepo *db.DBRepo
	mem    repository.RelationshipRuleRepo
}

func NewRelationshipRuleRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *RelationshipRuleRepo {
	return &RelationshipRuleRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.RelationshipRulesRepo(),
	}
}

func (r *RelationshipRuleRepo) Get(id string) (*oapi.RelationshipRule, bool) {
	return r.mem.Get(id)
}

func (r *RelationshipRuleRepo) Set(entity *oapi.RelationshipRule) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.RelationshipRules().Set(entity)
}

func (r *RelationshipRuleRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.RelationshipRules().Remove(id)
}

func (r *RelationshipRuleRepo) Items() map[string]*oapi.RelationshipRule {
	return r.mem.Items()
}
