package workflows

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

type WorkflowRepo struct {
	ctx         context.Context
	workspaceID string
}

func NewWorkflowRepo(ctx context.Context, workspaceID string) *WorkflowRepo {
	return &WorkflowRepo{ctx: ctx, workspaceID: workspaceID}
}

func (r *WorkflowRepo) Get(id string) (*oapi.Workflow, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse workflow id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetWorkflowByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	return WorkflowToOapi(row), true
}

func (r *WorkflowRepo) Set(entity *oapi.Workflow) error {
	params, err := ToWorkflowUpsertParams(r.workspaceID, entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	_, err = db.GetQueries(r.ctx).UpsertWorkflow(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert workflow: %w", err)
	}
	return nil
}

func (r *WorkflowRepo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteWorkflow(r.ctx, uid)
}

func (r *WorkflowRepo) Items() map[string]*oapi.Workflow {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.Workflow)
	}

	rows, err := db.GetQueries(r.ctx).ListWorkflowsByWorkspaceID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list workflows by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.Workflow)
	}

	result := make(map[string]*oapi.Workflow, len(rows))
	for _, row := range rows {
		w := WorkflowToOapi(row)
		result[w.Id] = w
	}
	return result
}

type WorkflowJobTemplateRepo struct {
	ctx         context.Context
	workspaceID string
}

func NewWorkflowJobTemplateRepo(ctx context.Context, workspaceID string) *WorkflowJobTemplateRepo {
	return &WorkflowJobTemplateRepo{ctx: ctx, workspaceID: workspaceID}
}

func (r *WorkflowJobTemplateRepo) Get(id string) (*oapi.WorkflowJobTemplate, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse workflow job template id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetWorkflowJobTemplateByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	return WorkflowJobTemplateToOapi(row), true
}

func (r *WorkflowJobTemplateRepo) Set(entity *oapi.WorkflowJobTemplate) error {
	params, err := ToWorkflowJobTemplateUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	_, err = db.GetQueries(r.ctx).UpsertWorkflowJobTemplate(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert workflow job template: %w", err)
	}
	return nil
}

func (r *WorkflowJobTemplateRepo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteWorkflowJobTemplate(r.ctx, uid)
}

func (r *WorkflowJobTemplateRepo) Items() map[string]*oapi.WorkflowJobTemplate {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.WorkflowJobTemplate)
	}

	rows, err := db.GetQueries(r.ctx).ListWorkflowJobTemplatesByWorkspaceID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list workflow job templates by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.WorkflowJobTemplate)
	}

	result := make(map[string]*oapi.WorkflowJobTemplate, len(rows))
	for _, row := range rows {
		jt := WorkflowJobTemplateToOapi(row)
		result[jt.Id] = jt
	}
	return result
}

type WorkflowRunRepo struct {
	ctx         context.Context
	workspaceID string
}

func NewWorkflowRunRepo(ctx context.Context, workspaceID string) *WorkflowRunRepo {
	return &WorkflowRunRepo{ctx: ctx, workspaceID: workspaceID}
}

func (r *WorkflowRunRepo) Get(id string) (*oapi.WorkflowRun, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse workflow run id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetWorkflowRunByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	return WorkflowRunToOapi(row), true
}

func (r *WorkflowRunRepo) Set(entity *oapi.WorkflowRun) error {
	params, err := ToWorkflowRunUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	_, err = db.GetQueries(r.ctx).UpsertWorkflowRun(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert workflow run: %w", err)
	}
	return nil
}

func (r *WorkflowRunRepo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteWorkflowRun(r.ctx, uid)
}

func (r *WorkflowRunRepo) Items() map[string]*oapi.WorkflowRun {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.WorkflowRun)
	}

	rows, err := db.GetQueries(r.ctx).ListWorkflowRunsByWorkspaceID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list workflow runs by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.WorkflowRun)
	}

	result := make(map[string]*oapi.WorkflowRun, len(rows))
	for _, row := range rows {
		wr := WorkflowRunToOapi(row)
		result[wr.Id] = wr
	}
	return result
}

func (r *WorkflowRunRepo) GetByWorkflowID(workflowID string) ([]*oapi.WorkflowRun, error) {
	uid, err := uuid.Parse(workflowID)
	if err != nil {
		return nil, fmt.Errorf("parse workflow_id: %w", err)
	}

	rows, err := db.GetQueries(r.ctx).ListWorkflowRunsByWorkflowID(r.ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("list workflow runs: %w", err)
	}

	result := make([]*oapi.WorkflowRun, len(rows))
	for i, row := range rows {
		result[i] = WorkflowRunToOapi(row)
	}
	return result, nil
}

type WorkflowJobRepo struct {
	ctx         context.Context
	workspaceID string
}

func NewWorkflowJobRepo(ctx context.Context, workspaceID string) *WorkflowJobRepo {
	return &WorkflowJobRepo{ctx: ctx, workspaceID: workspaceID}
}

func (r *WorkflowJobRepo) Get(id string) (*oapi.WorkflowJob, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse workflow job id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetWorkflowJobByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	return WorkflowJobToOapi(row), true
}

func (r *WorkflowJobRepo) Set(entity *oapi.WorkflowJob) error {
	params, err := ToWorkflowJobUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	_, err = db.GetQueries(r.ctx).UpsertWorkflowJob(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert workflow job: %w", err)
	}
	return nil
}

func (r *WorkflowJobRepo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteWorkflowJob(r.ctx, uid)
}

func (r *WorkflowJobRepo) Items() map[string]*oapi.WorkflowJob {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.WorkflowJob)
	}

	rows, err := db.GetQueries(r.ctx).ListWorkflowJobsByWorkspaceID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list workflow jobs by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.WorkflowJob)
	}

	result := make(map[string]*oapi.WorkflowJob, len(rows))
	for _, row := range rows {
		wj := WorkflowJobToOapi(row)
		result[wj.Id] = wj
	}
	return result
}

func (r *WorkflowJobRepo) GetByWorkflowRunID(workflowRunID string) ([]*oapi.WorkflowJob, error) {
	uid, err := uuid.Parse(workflowRunID)
	if err != nil {
		return nil, fmt.Errorf("parse workflow_run_id: %w", err)
	}

	rows, err := db.GetQueries(r.ctx).ListWorkflowJobsByWorkflowRunID(r.ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("list workflow jobs: %w", err)
	}

	result := make([]*oapi.WorkflowJob, len(rows))
	for i, row := range rows {
		result[i] = WorkflowJobToOapi(row)
	}
	return result, nil
}
