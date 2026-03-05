package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type WorkflowRepo struct {
	dbRepo *db.DBRepo
	mem    repository.WorkflowRepo
}

func NewWorkflowRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *WorkflowRepo {
	return &WorkflowRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.Workflows(),
	}
}

func (r *WorkflowRepo) Get(id string) (*oapi.Workflow, bool) {
	return r.mem.Get(id)
}

func (r *WorkflowRepo) Set(entity *oapi.Workflow) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.Workflows().Set(entity)
}

func (r *WorkflowRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.Workflows().Remove(id)
}

func (r *WorkflowRepo) Items() map[string]*oapi.Workflow {
	return r.mem.Items()
}

type WorkflowJobTemplateRepo struct {
	dbRepo *db.DBRepo
	mem    repository.WorkflowJobTemplateRepo
}

func NewWorkflowJobTemplateRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *WorkflowJobTemplateRepo {
	return &WorkflowJobTemplateRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.WorkflowJobTemplates(),
	}
}

func (r *WorkflowJobTemplateRepo) Get(id string) (*oapi.WorkflowJobTemplate, bool) {
	return r.mem.Get(id)
}

func (r *WorkflowJobTemplateRepo) Set(entity *oapi.WorkflowJobTemplate) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.WorkflowJobTemplates().Set(entity)
}

func (r *WorkflowJobTemplateRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.WorkflowJobTemplates().Remove(id)
}

func (r *WorkflowJobTemplateRepo) Items() map[string]*oapi.WorkflowJobTemplate {
	return r.mem.Items()
}

type WorkflowRunRepo struct {
	dbRepo *db.DBRepo
	mem    repository.WorkflowRunRepo
}

func NewWorkflowRunRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *WorkflowRunRepo {
	return &WorkflowRunRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.WorkflowRuns(),
	}
}

func (r *WorkflowRunRepo) Get(id string) (*oapi.WorkflowRun, bool) {
	return r.mem.Get(id)
}

func (r *WorkflowRunRepo) GetByWorkflowID(workflowID string) ([]*oapi.WorkflowRun, error) {
	return r.mem.GetByWorkflowID(workflowID)
}

func (r *WorkflowRunRepo) Set(entity *oapi.WorkflowRun) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.WorkflowRuns().Set(entity)
}

func (r *WorkflowRunRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.WorkflowRuns().Remove(id)
}

func (r *WorkflowRunRepo) Items() map[string]*oapi.WorkflowRun {
	return r.mem.Items()
}

type WorkflowJobRepo struct {
	dbRepo *db.DBRepo
	mem    repository.WorkflowJobRepo
}

func NewWorkflowJobRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *WorkflowJobRepo {
	return &WorkflowJobRepo{
		dbRepo: dbRepo,
		mem:    inMemoryRepo.WorkflowJobs(),
	}
}

func (r *WorkflowJobRepo) Get(id string) (*oapi.WorkflowJob, bool) {
	return r.mem.Get(id)
}

func (r *WorkflowJobRepo) GetByWorkflowRunID(workflowRunID string) ([]*oapi.WorkflowJob, error) {
	return r.mem.GetByWorkflowRunID(workflowRunID)
}

func (r *WorkflowJobRepo) Set(entity *oapi.WorkflowJob) error {
	if err := r.mem.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.WorkflowJobs().Set(entity)
}

func (r *WorkflowJobRepo) Remove(id string) error {
	if err := r.mem.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.WorkflowJobs().Remove(id)
}

func (r *WorkflowJobRepo) Items() map[string]*oapi.WorkflowJob {
	return r.mem.Items()
}
