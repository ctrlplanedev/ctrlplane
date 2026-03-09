package jobs

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

var _ Getters = (*storeGetters)(nil)

type storeGetters struct {
	store *store.Store
}

func NewStoreGetters(store *store.Store) *storeGetters {
	return &storeGetters{store: store}
}

func (s *storeGetters) GetDeployment(ctx context.Context, deploymentID uuid.UUID) (*oapi.Deployment, error) {
	deployment, ok := s.store.Deployments.Get(deploymentID.String())
	if !ok {
		return nil, fmt.Errorf("deployment not found")
	}
	return deployment, nil
}

func (s *storeGetters) GetEnvironment(ctx context.Context, environmentID uuid.UUID) (*oapi.Environment, error) {
	environment, ok := s.store.Environments.Get(environmentID.String())
	if !ok {
		return nil, fmt.Errorf("environment not found")
	}
	return environment, nil
}

func (s *storeGetters) GetResource(ctx context.Context, resourceID uuid.UUID) (*oapi.Resource, error) {
	resource, ok := s.store.Resources.Get(resourceID.String())
	if !ok {
		return nil, fmt.Errorf("resource not found")
	}
	return resource, nil
}
