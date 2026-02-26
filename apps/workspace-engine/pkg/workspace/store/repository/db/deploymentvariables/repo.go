package deploymentvariables

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

type VariableRepo struct {
	ctx         context.Context
	workspaceID string
}

func NewVariableRepo(ctx context.Context, workspaceID string) *VariableRepo {
	return &VariableRepo{ctx: ctx, workspaceID: workspaceID}
}

func (r *VariableRepo) Get(id string) (*oapi.DeploymentVariable, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse deployment variable id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetDeploymentVariableByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	return VariableToOapi(row), true
}

func (r *VariableRepo) Set(entity *oapi.DeploymentVariable) error {
	params, err := ToVariableUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	_, err = db.GetQueries(r.ctx).UpsertDeploymentVariable(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert deployment variable: %w", err)
	}
	return nil
}

func (r *VariableRepo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteDeploymentVariable(r.ctx, uid)
}

func (r *VariableRepo) Items() map[string]*oapi.DeploymentVariable {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.DeploymentVariable)
	}

	rows, err := db.GetQueries(r.ctx).ListDeploymentVariablesByWorkspaceID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list deployment variables by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.DeploymentVariable)
	}

	result := make(map[string]*oapi.DeploymentVariable, len(rows))
	for _, row := range rows {
		dv := VariableToOapi(row)
		result[dv.Id] = dv
	}
	return result
}

func (r *VariableRepo) GetByDeploymentID(deploymentID string) ([]*oapi.DeploymentVariable, error) {
	uid, err := uuid.Parse(deploymentID)
	if err != nil {
		return nil, fmt.Errorf("parse deployment_id: %w", err)
	}

	rows, err := db.GetQueries(r.ctx).ListDeploymentVariablesByDeploymentID(r.ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("list deployment variables: %w", err)
	}

	result := make([]*oapi.DeploymentVariable, len(rows))
	for i, row := range rows {
		result[i] = VariableToOapi(row)
	}
	return result, nil
}

type ValueRepo struct {
	ctx         context.Context
	workspaceID string
}

func NewValueRepo(ctx context.Context, workspaceID string) *ValueRepo {
	return &ValueRepo{ctx: ctx, workspaceID: workspaceID}
}

func (r *ValueRepo) Get(id string) (*oapi.DeploymentVariableValue, bool) {
	uid, err := uuid.Parse(id)
	if err != nil {
		log.Warn("Failed to parse deployment variable value id", "id", id, "error", err)
		return nil, false
	}

	row, err := db.GetQueries(r.ctx).GetDeploymentVariableValueByID(r.ctx, uid)
	if err != nil {
		return nil, false
	}

	return ValueToOapi(row), true
}

func (r *ValueRepo) Set(entity *oapi.DeploymentVariableValue) error {
	params, err := ToValueUpsertParams(entity)
	if err != nil {
		return fmt.Errorf("convert to upsert params: %w", err)
	}

	_, err = db.GetQueries(r.ctx).UpsertDeploymentVariableValue(r.ctx, params)
	if err != nil {
		return fmt.Errorf("upsert deployment variable value: %w", err)
	}
	return nil
}

func (r *ValueRepo) Remove(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("parse id: %w", err)
	}

	return db.GetQueries(r.ctx).DeleteDeploymentVariableValue(r.ctx, uid)
}

func (r *ValueRepo) Items() map[string]*oapi.DeploymentVariableValue {
	uid, err := uuid.Parse(r.workspaceID)
	if err != nil {
		log.Warn("Failed to parse workspace id for Items()", "id", r.workspaceID, "error", err)
		return make(map[string]*oapi.DeploymentVariableValue)
	}

	rows, err := db.GetQueries(r.ctx).ListDeploymentVariableValuesByWorkspaceID(r.ctx, uid)
	if err != nil {
		log.Warn("Failed to list deployment variable values by workspace", "workspaceId", r.workspaceID, "error", err)
		return make(map[string]*oapi.DeploymentVariableValue)
	}

	result := make(map[string]*oapi.DeploymentVariableValue, len(rows))
	for _, row := range rows {
		dvv := ValueToOapi(row)
		result[dvv.Id] = dvv
	}
	return result
}

func (r *ValueRepo) GetByVariableID(variableID string) ([]*oapi.DeploymentVariableValue, error) {
	uid, err := uuid.Parse(variableID)
	if err != nil {
		return nil, fmt.Errorf("parse deployment_variable_id: %w", err)
	}

	rows, err := db.GetQueries(r.ctx).ListDeploymentVariableValuesByVariableID(r.ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("list deployment variable values: %w", err)
	}

	result := make([]*oapi.DeploymentVariableValue, len(rows))
	for i, row := range rows {
		result[i] = ValueToOapi(row)
	}
	return result, nil
}
