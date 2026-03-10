package store

import (
	"context"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

var deploymentVariablesTracer = otel.Tracer("workspace/store/deployment_variables")

func NewDeploymentVariables(store *Store) *DeploymentVariables {
	return &DeploymentVariables{
		repo:  store.repo.DeploymentVariables(),
		store: store,
	}
}

type DeploymentVariables struct {
	repo  repository.DeploymentVariableRepo
	store *Store
}

func (d *DeploymentVariables) SetRepo(repo repository.DeploymentVariableRepo) {
	d.repo = repo
}

func (d *DeploymentVariables) Items() map[string]*oapi.DeploymentVariable {
	return d.repo.Items()
}

func (d *DeploymentVariables) Get(id string) (*oapi.DeploymentVariable, bool) {
	return d.repo.Get(id)
}

func (d *DeploymentVariables) Upsert(
	ctx context.Context,
	id string,
	deploymentVariable *oapi.DeploymentVariable,
) {
	_, span := deploymentVariablesTracer.Start(ctx, "UpsertDeploymentVariable")
	defer span.End()

	if err := d.repo.Set(deploymentVariable); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to upsert deployment variable")
		log.Error("Failed to upsert deployment variable", "error", err)
		return
	}
	d.store.changeset.RecordUpsert(deploymentVariable)
}

func (d *DeploymentVariables) Remove(ctx context.Context, id string) {
	deploymentVariable, ok := d.repo.Get(id)
	if !ok || deploymentVariable == nil {
		return
	}
	if err := d.repo.Remove(id); err != nil {
		log.Error("Failed to remove deployment variable", "error", err)
		return
	}
	d.store.changeset.RecordDelete(deploymentVariable)
}

func (d *DeploymentVariables) Values(variableId string) map[string]*oapi.DeploymentVariableValue {
	dvvs, err := d.store.DeploymentVariableValues.repo.GetByVariableID(variableId)
	if err != nil {
		return make(map[string]*oapi.DeploymentVariableValue)
	}
	values := make(map[string]*oapi.DeploymentVariableValue, len(dvvs))
	for _, v := range dvvs {
		values[v.Id] = v
	}
	return values
}
