package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
)

var deploymentsTracer = otel.Tracer("workspace/store/deployments")

func NewDeployments(store *Store) *Deployments {
	deployments := &Deployments{
		repo:  store.repo.Deployments(),
		store: store,
	}

	return deployments
}

type Deployments struct {
	repo  repository.DeploymentRepo
	store *Store
}

// SetRepo replaces the underlying DeploymentRepo implementation.
func (e *Deployments) SetRepo(repo repository.DeploymentRepo) {
	e.repo = repo
}

func (e *Deployments) Get(id string) (*oapi.Deployment, bool) {
	return e.repo.Get(id)
}

func (e *Deployments) Upsert(ctx context.Context, deployment *oapi.Deployment) error {
	_, span := deploymentsTracer.Start(ctx, "UpsertDeployment")
	defer span.End()

	if err := e.repo.Set(deployment); err != nil {
		log.Error("Failed to upsert deployment", "error", err)
	}
	e.store.changeset.RecordUpsert(deployment)

	return nil
}

func (e *Deployments) Remove(ctx context.Context, id string) {
	deployment, ok := e.repo.Get(id)
	if !ok || deployment == nil {
		return
	}

	e.repo.Remove(id)
	e.store.changeset.RecordDelete(deployment)
}

func (e *Deployments) Variables(deploymentId string) map[string]*oapi.DeploymentVariable {
	vars := make(map[string]*oapi.DeploymentVariable)
	for _, variable := range e.store.repo.DeploymentVariables.Items() {
		if variable.DeploymentId == deploymentId {
			vars[variable.Key] = variable
		}
	}
	return vars
}

func (e *Deployments) Items() map[string]*oapi.Deployment {
	return e.repo.Items()
}

func (e *Deployments) Resources(ctx context.Context, deploymentId string) ([]*oapi.Resource, error) {
	deployment, ok := e.Get(deploymentId)
	if !ok {
		return nil, fmt.Errorf("deployment %s not found", deploymentId)
	}

	allResourcesSlice := make([]*oapi.Resource, 0)
	for _, resource := range e.store.Resources.Items() {
		allResourcesSlice = append(allResourcesSlice, resource)
	}

	resources, err := selector.FilterResources(ctx, deployment.ResourceSelector, allResourcesSlice)
	if err != nil {
		return nil, err
	}

	resourcesSlice := make([]*oapi.Resource, 0, len(resources))
	for _, resource := range resources {
		resourcesSlice = append(resourcesSlice, resource)
	}

	return resourcesSlice, nil
}

func (e *Deployments) ForResource(ctx context.Context, resource *oapi.Resource) ([]*oapi.Deployment, error) {
	deployments := make([]*oapi.Deployment, 0)
	for _, deployment := range e.Items() {
		matched, err := selector.Match(ctx, deployment.ResourceSelector, resource)
		if err != nil {
			return nil, err
		}
		if matched {
			deployments = append(deployments, deployment)
		}
	}
	return deployments, nil
}

func (e *Deployments) ForJobAgent(ctx context.Context, jobAgent *oapi.JobAgent) ([]*oapi.Deployment, error) {
	deployments := make([]*oapi.Deployment, 0)
	for _, deployment := range e.Items() {
		if deployment.JobAgentId != nil && *deployment.JobAgentId == jobAgent.Id {
			deployments = append(deployments, deployment)
		}
	}
	return deployments, nil
}
