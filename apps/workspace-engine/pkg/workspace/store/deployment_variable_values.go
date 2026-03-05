package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
)

var deploymentVariableValuesTracer = otel.Tracer("workspace/store/deployment_variable_values")

func NewDeploymentVariableValues(store *Store) *DeploymentVariableValues {
	return &DeploymentVariableValues{
		repo:  store.repo.DeploymentVariableValues(),
		store: store,
	}
}

type DeploymentVariableValues struct {
	repo  repository.DeploymentVariableValueRepo
	store *Store
}

func (d *DeploymentVariableValues) SetRepo(repo repository.DeploymentVariableValueRepo) {
	d.repo = repo
}

func (d *DeploymentVariableValues) Items() map[string]*oapi.DeploymentVariableValue {
	return d.repo.Items()
}

func (d *DeploymentVariableValues) Get(id string) (*oapi.DeploymentVariableValue, bool) {
	return d.repo.Get(id)
}

func (d *DeploymentVariableValues) Upsert(ctx context.Context, id string, deploymentVariableValue *oapi.DeploymentVariableValue) {
	_, span := deploymentVariableValuesTracer.Start(ctx, "UpsertDeploymentVariableValue")
	defer span.End()

	if err := d.repo.Set(deploymentVariableValue); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to upsert deployment variable value")
		log.Error("Failed to upsert deployment variable value", "error", err)
		return
	}
	d.store.changeset.RecordUpsert(deploymentVariableValue)
}

func (d *DeploymentVariableValues) Remove(ctx context.Context, id string) {
	deploymentVariableValue, ok := d.repo.Get(id)
	if !ok || deploymentVariableValue == nil {
		return
	}

	if err := d.repo.Remove(id); err != nil {
		log.Error("Failed to remove deployment variable value", "error", err)
		return
	}
	d.store.changeset.RecordDelete(deploymentVariableValue)
}
