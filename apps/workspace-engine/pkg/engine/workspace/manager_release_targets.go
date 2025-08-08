package workspace

import (
	"context"
	"fmt"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/resource"

	"github.com/charmbracelet/log"
)

func NewReleaseTargetManager(selectorManager *SelectorManager, releaseTargetRepository *WorkspaceRepository) *ReleaseTargetManager {
	return &ReleaseTargetManager{
		repository:      releaseTargetRepository,
		selectorManager: selectorManager,
	}
}

type ReleaseTargetManager struct {
	repository      *WorkspaceRepository
	selectorManager *SelectorManager
}

func (rm *ReleaseTargetManager) DetermineReleaseTargets(ctx context.Context) ([]*rt.ReleaseTarget, error) {
	log.Debug("Determining release targets")

	// Get all environments and deployments
	environments, err := rm.selectorManager.EnvironmentResources.GetAllSelectors(ctx)
	if err != nil {
		return nil, err
	}

	deployments, err := rm.selectorManager.DeploymentResources.GetAllSelectors(ctx)
	if err != nil {
		return nil, err
	}

	var releaseTargets []*rt.ReleaseTarget

	// For each environment-deployment pair that belongs to the same system
	for _, env := range environments {
		for _, dep := range deployments {
			// Check if they belong to the same system
			if env.SystemID != dep.SystemID {
				continue
			}

			// Get resources that match both environment and deployment
			envResources, err := rm.selectorManager.EnvironmentResources.GetEntitiesForSelector(ctx, env)
			if err != nil {
				log.Error("Failed to get resources for environment", "envID", env.ID, "error", err)
				continue
			}

			depResources, err := rm.selectorManager.DeploymentResources.GetEntitiesForSelector(ctx, dep)
			if err != nil {
				log.Error("Failed to get resources for deployment", "depID", dep.ID, "error", err)
				continue
			}

			// Find common resources between environment and deployment
			commonResources := findCommonResources(envResources, depResources)

			// Create a release target for each common resource
			for _, resource := range commonResources {
				releaseTarget := &rt.ReleaseTarget{
					Resource:    resource,
					Environment: env,
					Deployment:  dep,
				}
				releaseTargets = append(releaseTargets, releaseTarget)
			}
		}
	}

	log.Debug("Determined release targets", "count", len(releaseTargets))
	return releaseTargets, nil
}

// findCommonResources returns resources that exist in both slices
func findCommonResources(envResources, depResources []resource.Resource) []resource.Resource {
	// Create a map for efficient lookup
	depResourceMap := model.CreateMap(depResources)

	var commonResources []resource.Resource
	for _, envRes := range envResources {
		if _, exists := depResourceMap[envRes.GetID()]; exists {
			commonResources = append(commonResources, envRes)
		}
	}

	return commonResources
}

type ReleaseTargetChanges struct {
	Added   []*rt.ReleaseTarget
	Removed []*rt.ReleaseTarget
}

func (rm *ReleaseTargetManager) ComputeReleaseTargetChanges(ctx context.Context) (*ReleaseTargetChanges, error) {
	existingReleaseTargets := model.CreateMap(rm.repository.ReleaseTarget.GetAll(ctx))
	computedReleaseTargets, err := rm.DetermineReleaseTargets(ctx)
	if err != nil {
		return nil, err
	}
	computedReleaseTargetsMap := model.CreateMap(computedReleaseTargets)

	changes := &ReleaseTargetChanges{
		Added:   []*rt.ReleaseTarget{},
		Removed: []*rt.ReleaseTarget{},
	}

	for _, computedReleaseTarget := range computedReleaseTargets {
		if _, exists := existingReleaseTargets[computedReleaseTarget.GetID()]; !exists {
			changes.Added = append(changes.Added, computedReleaseTarget)
		}
	}

	for _, existingReleaseTarget := range existingReleaseTargets {
		if _, exists := computedReleaseTargetsMap[existingReleaseTarget.GetID()]; !exists {
			changes.Removed = append(changes.Removed, existingReleaseTarget)
		}
	}

	return changes, nil
}

// PersistChanges applies the computed release target changes to the repository
func (rm *ReleaseTargetManager) PersistChanges(ctx context.Context, changes *ReleaseTargetChanges) error {
	// Remove targets that no longer exist
	for _, target := range changes.Removed {
		if err := rm.repository.ReleaseTarget.Delete(ctx, target.GetID()); err != nil {
			return fmt.Errorf("failed to delete release target %s: %w", target.GetID(), err)
		}
	}

	// Add new targets
	for _, target := range changes.Added {
		if err := rm.repository.ReleaseTarget.Create(ctx, target); err != nil {
			return fmt.Errorf("failed to create release target %s: %w", target.GetID(), err)
		}
	}

	return nil
}
