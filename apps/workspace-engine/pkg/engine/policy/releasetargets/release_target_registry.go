// Package policy provides repository implementations for managing policy-related entities
// in the workspace engine. This file specifically handles the in-memory storage and
// management of release targets, which represent combinations of resources, deployments,
// and environments that policies can be applied to.
package releasetargets

import (
	"context"
	"fmt"
	"slices"
	"workspace-engine/pkg/model"
)

// NewReleaseTargetRepository creates a new in-memory repository for managing release targets.
// The repository provides thread-safe operations for CRUD operations on release targets
// and supports advanced querying and batch operations.
//
// Returns:
//   - *ReleaseTargetRepository: A new repository instance with an empty release target store
//
// Example:
//
//	repo := NewReleaseTargetRepository()
//	target := &ReleaseTarget{...}
//	err := repo.Create(ctx, target)
func NewReleaseTargetRepository() *ReleaseTargetRepository {
	return &ReleaseTargetRepository{
		ReleaseTargets: make(map[string]*ReleaseTarget),
	}
}

// Compile-time check to ensure ReleaseTargetRepository implements Repository interface
var _ model.Repository[ReleaseTarget] = (*ReleaseTargetRepository)(nil)

// ReleaseTargetRepository provides an in-memory implementation of the Repository interface
// for managing ReleaseTarget entities. It uses a map-based storage for fast lookups by ID
// and supports all standard CRUD operations as well as specialized batch operations.
//
// This repository is designed for use in scenarios where release targets need to be
// dynamically managed during policy evaluation and deployment processes.
//
// Thread Safety: This implementation is NOT thread-safe. External synchronization
// is required when used in concurrent environments. Consider using sync.RWMutex for
// concurrent access patterns.
//
// Performance: All operations are O(1) for single-entity operations and O(n) for
// batch operations where n is the number of entities in the repository.
type ReleaseTargetRepository struct {
	// ReleaseTargets stores all release targets indexed by their unique ID
	// The ID is computed as: ResourceID + DeploymentID + EnvironmentID
	ReleaseTargets map[string]*ReleaseTarget
}

// Create implements Repository.Create by storing a new release target in the repository.
// If a release target with the same ID already exists, it will be overwritten.
//
// Parameters:
//   - ctx: Context for cancellation and request-scoped values
//   - entity: The release target to create. Must not be nil.
//
// Returns:
//   - error: Always returns nil in this implementation
//
// Example:
//
//	target := &ReleaseTarget{Resource: res, Deployment: dep, Environment: env}
//	err := repo.Create(ctx, target)
func (r *ReleaseTargetRepository) Create(ctx context.Context, entity *ReleaseTarget) error {
	if entity == nil {
		return fmt.Errorf("entity cannot be nil")
	}
	r.ReleaseTargets[entity.GetID()] = entity
	return nil
}

// Exists checks if a release target with the given ID already exists in the repository.
//
// Parameters:
//   - ctx: Context for cancellation and request-scoped values
//   - entityID: The unique identifier of the release target to check
//
// Returns:
//   - bool: True if the release target exists, false otherwise
//
// Example:
//
//	exists := repo.Exists(ctx, "resource1deployment1environment1")
func (r *ReleaseTargetRepository) Exists(ctx context.Context, entityID string) bool {
	_, exists := r.ReleaseTargets[entityID]
	return exists
}

// CreateIfNotExists creates a release target only if it doesn't already exist in the repository.
// This method provides atomic check-and-create semantics for idempotent operations.
//
// Parameters:
//   - ctx: Context for cancellation and request-scoped values
//   - entity: The release target to create. Must not be nil.
//
// Returns:
//   - bool: True if the release target was created, false if it already existed
//   - error: Error if the creation failed, nil otherwise
//
// Example:
//
//	target := &ReleaseTarget{...}
//	created, err := repo.CreateIfNotExists(ctx, target)
//	if created {
//	    log.Info("Release target created successfully")
//	}
func (r *ReleaseTargetRepository) CreateIfNotExists(ctx context.Context, entity *ReleaseTarget) (bool, error) {
	if entity == nil {
		return false, fmt.Errorf("entity cannot be nil")
	}

	if r.Exists(ctx, entity.GetID()) {
		return false, nil
	}

	err := r.Create(ctx, entity)
	return err == nil, err
}

// Delete implements Repository.Delete by removing a release target from the repository.
// If the release target doesn't exist, this operation is a no-op and returns no error.
//
// Parameters:
//   - ctx: Context for cancellation and request-scoped values
//   - entityID: The unique identifier of the release target to delete
//
// Returns:
//   - error: Always returns nil in this implementation
//
// Example:
//
//	err := repo.Delete(ctx, "resource1deployment1environment1")
func (r *ReleaseTargetRepository) Delete(ctx context.Context, entityID string) error {
	delete(r.ReleaseTargets, entityID)
	return nil
}

// Get implements Repository.Get by retrieving a release target by its unique identifier.
//
// Parameters:
//   - ctx: Context for cancellation and request-scoped values
//   - entityID: The unique identifier of the release target to retrieve
//
// Returns:
//   - *ReleaseTarget: The release target if found, nil if not found
//
// Example:
//
//	target := repo.Get(ctx, "resource1deployment1environment1")
//	if target != nil {
//	    // Process the release target
//	}
func (r *ReleaseTargetRepository) Get(ctx context.Context, entityID string) *ReleaseTarget {
	return r.ReleaseTargets[entityID]
}

// GetAll implements Repository.GetAll by returning all release targets in the repository.
// The returned slice is a copy and can be safely modified without affecting the repository.
//
// Parameters:
//   - ctx: Context for cancellation and request-scoped values
//
// Returns:
//   - []*ReleaseTarget: A slice containing all release targets in the repository
//
// Example:
//
//	targets := repo.GetAll(ctx)
//	log.Infof("Found %d release targets", len(targets))
func (r *ReleaseTargetRepository) GetAll(ctx context.Context) []*ReleaseTarget {
	releaseTargets := make([]*ReleaseTarget, 0, len(r.ReleaseTargets))
	for _, releaseTarget := range r.ReleaseTargets {
		releaseTargets = append(releaseTargets, releaseTarget)
	}
	return releaseTargets
}

// Update implements Repository.Update by updating an existing release target.
// This operation overwrites the existing release target with the provided entity.
//
// Parameters:
//   - ctx: Context for cancellation and request-scoped values
//   - entity: The updated release target. Must not be nil.
//
// Returns:
//   - error: Always returns nil in this implementation
//
// Example:
//
//	target.SomeField = "new value"
//	err := repo.Update(ctx, target)
func (r *ReleaseTargetRepository) Update(ctx context.Context, entity *ReleaseTarget) error {
	if entity == nil {
		return fmt.Errorf("entity cannot be nil")
	}
	r.ReleaseTargets[entity.GetID()] = entity
	return nil
}

// ReleaseTargetChanges represents the result of a batch operation on release targets.
// It tracks which targets were added, removed, or already existed during the operation.
// This is useful for auditing, logging, and understanding the impact of batch updates.
type ReleaseTargetChanges struct {
	// Added contains release targets that were newly created during the operation
	Added []*ReleaseTarget

	// Removed contains release targets that were deleted during the operation
	Removed []*ReleaseTarget

	// AlreadyExisted contains release targets that were already present and updated
	AlreadyExisted []*ReleaseTarget
}

// Summary returns a human-readable summary of the changes made during the operation.
// This is useful for logging and debugging batch operations.
//
// Returns:
//   - string: A formatted summary showing counts of added, removed, and existing targets
//
// Example:
//
//	changes := repo.SetReleaseTargetsForDeployment(...)
//	log.Info(changes.Summary()) // "Added: 3, Removed: 1, Already Existed: 2"
func (c *ReleaseTargetChanges) Summary() string {
	return fmt.Sprintf("Added: %d, Removed: %d, Already Existed: %d",
		len(c.Added), len(c.Removed), len(c.AlreadyExisted))
}

// HasChanges returns true if there are any additions or removals in this change set.
// This method is useful for determining if any actual modifications were made.
//
// Returns:
//   - bool: True if any targets were added or removed, false if only updates occurred
//
// Example:
//
//	changes := repo.SetReleaseTargetsForDeployment(...)
//	if changes.HasChanges() {
//	    log.Info("Deployment targets were modified")
//	}
func (c *ReleaseTargetChanges) HasChanges() bool {
	return len(c.Added) > 0 || len(c.Removed) > 0
}

// SetReleaseTargetsForDeploymentsAndEnvironments atomically updates release targets that match
// the specified deployment and environment combinations. This method performs a complete
// replacement operation for targets that match both the deployment IDs and environment IDs.
//
// The operation uses an intersection logic: only targets whose deployment AND environment
// match the provided lists will be affected. This allows for fine-grained control over
// which release targets are managed during batch operations.
//
// Parameters:
//   - ctx: Context for cancellation and request-scoped values
//   - deploymentIDs: List of deployment IDs to match against
//   - environmentIDs: List of environment IDs to match against
//   - releaseTargets: The complete list of release targets that should exist for the matching combinations
//
// Returns:
//   - ReleaseTargetChanges: Details about what was added, removed, or updated
//   - error: Error if any operation failed (all changes are rolled back on error)
//
// Example:
//
//	deployments := []string{"dep1", "dep2"}
//	environments := []string{"prod", "staging"}
//	newTargets := []ReleaseTarget{target1, target2}
//	changes, err := repo.SetReleaseTargetsForDeploymentsAndEnvironments(ctx, deployments, environments, newTargets)
//	if err != nil {
//	    log.Errorf("Failed to update targets: %v", err)
//	}
func (r *ReleaseTargetRepository) SetReleaseTargetsForDeploymentsAndEnvironments(
	ctx context.Context,
	deploymentIDs []string,
	environmentIDs []string,
	releaseTargets []*ReleaseTarget,
) (ReleaseTargetChanges, error) {

	// Find all existing targets that match the deployment and environment criteria
	existingReleaseTargets := make(map[string]*ReleaseTarget)
	for _, target := range r.GetAll(ctx) {
		isDeploymentMatch := slices.Contains(deploymentIDs, target.Deployment.GetID())
		isEnvironmentMatch := slices.Contains(environmentIDs, target.Environment.GetID())
		if isDeploymentMatch && isEnvironmentMatch {
			existingReleaseTargets[target.GetID()] = target
		}
	}

	// Create lookup map for new targets
	releaseTargetMap := model.CreateMap(releaseTargets)

	changes := buildReleaseTargetChanges(releaseTargetMap, existingReleaseTargets)

	if err := r.applyReleaseTargetChanges(ctx, changes); err != nil {
		return changes, err
	}

	return changes, nil
}

// applyReleaseTargetChanges executes the repository operations to apply the changes.
// It performs updates, deletions, and creations in the correct order to maintain consistency.
//
// Parameters:
//   - ctx: Context for cancellation and request-scoped values
//   - changes: The changes to apply containing added, removed, and existing targets
//
// Returns:
//   - error: Error if any operation failed, nil if all operations succeeded
func (r *ReleaseTargetRepository) applyReleaseTargetChanges(ctx context.Context, changes ReleaseTargetChanges) error {
	// Apply changes: update existing targets first
	for _, target := range changes.AlreadyExisted {
		if err := r.Update(ctx, target); err != nil {
			return fmt.Errorf("failed to update release target %s: %w", target.GetID(), err)
		}
	}

	// Remove targets that are no longer needed
	for _, target := range changes.Removed {
		if err := r.Delete(ctx, target.GetID()); err != nil {
			return fmt.Errorf("failed to delete release target %s: %w", target.GetID(), err)
		}
	}

	// Add new targets
	for _, target := range changes.Added {
		if err := r.Create(ctx, target); err != nil {
			return fmt.Errorf("failed to create release target %s: %w", target.GetID(), err)
		}
	}

	return nil
}

// buildReleaseTargetChanges compares new and existing target maps to build a ReleaseTargetChanges struct
func buildReleaseTargetChanges(
	computedTargets map[string]*ReleaseTarget,
	existingTargets map[string]*ReleaseTarget,
) ReleaseTargetChanges {
	changes := ReleaseTargetChanges{
		Added:          make([]*ReleaseTarget, 0),
		Removed:        make([]*ReleaseTarget, 0),
		AlreadyExisted: make([]*ReleaseTarget, 0),
	}

	// Identify additions and existing targets
	for id, target := range computedTargets {
		if _, exists := existingTargets[id]; !exists {
			changes.Added = append(changes.Added, target)
		} else {
			changes.AlreadyExisted = append(changes.AlreadyExisted, target)
		}
	}

	// Identify removals
	for id, target := range existingTargets {
		if _, exists := computedTargets[id]; !exists {
			changes.Removed = append(changes.Removed, target)
		}
	}

	return changes
}
