package releasetarget

import (
	"context"
	"fmt"
	"sync"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// ResourceIDSet is a set of resource IDs for fast O(1) lookup
type ResourceIDSet map[string]bool

// EnvironmentResourceSets maps environment IDs to their filtered resource ID sets
type EnvironmentResourceSets map[string]ResourceIDSet

// DeploymentResourceSets maps deployment IDs to their filtered resource ID sets
type DeploymentResourceSets map[string]ResourceIDSet

// Computation represents a fluent API for computing release targets
type Computation struct {
	ctx             context.Context
	req             *pb.ComputeReleaseTargetsRequest
	envResourceSets EnvironmentResourceSets
	depResourceSets DeploymentResourceSets
	envWg           sync.WaitGroup
	depWg           sync.WaitGroup
	err             error
	errMu           sync.Mutex
}

// NewComputation creates a new computation with the given context and request
func NewComputation(ctx context.Context, req *pb.ComputeReleaseTargetsRequest) *Computation {
	return &Computation{
		ctx: ctx,
		req: req,
	}
}

// FilterEnvironmentResources starts concurrent filtering of environment resources
// Does not wait - results will be ready when GenerateAndStream is called
func (c *Computation) FilterEnvironmentResources() *Computation {
	ctx, span := tracer.Start(c.ctx, "FilterEnvironmentResources",
		trace.WithAttributes(
			attribute.Int("environments.count", len(c.req.Environments)),
			attribute.Int("resources.total", len(c.req.Resources)),
		))
	defer span.End()
	
	c.errMu.Lock()
	hasErr := c.err != nil
	c.errMu.Unlock()
	
	if hasErr {
		span.RecordError(c.err)
		return c
	}

	c.envResourceSets = make(EnvironmentResourceSets, len(c.req.Environments))

	var (
		mu      sync.Mutex
		errOnce sync.Once
	)

	for _, env := range c.req.Environments {
		c.envWg.Add(1)
		go func(env *pb.Environment) {
			defer c.envWg.Done()

			resources, err := getResourcesForEnvironment(ctx, env, c.req.Resources)
			if err != nil {
				errOnce.Do(func() {
					c.errMu.Lock()
					c.err = fmt.Errorf("failed to get resources for environment %s: %w", env.Id, err)
					c.errMu.Unlock()
					span.RecordError(c.err)
				})
				return
			}

			resourceSet := NewResourceIDSet(resources)
			mu.Lock()
			c.envResourceSets[env.Id] = resourceSet
			mu.Unlock()
		}(env)
	}

	return c
}

// FilterDeploymentResources starts concurrent filtering of deployment resources
// Does not wait - results will be ready when GenerateAndStream is called
func (c *Computation) FilterDeploymentResources() *Computation {
	ctx, span := tracer.Start(c.ctx, "FilterDeploymentResources",
		trace.WithAttributes(
			attribute.Int("deployments.count", len(c.req.Deployments)),
			attribute.Int("resources.total", len(c.req.Resources)),
		))
	defer span.End()
	
	c.errMu.Lock()
	hasErr := c.err != nil
	c.errMu.Unlock()
	
	if hasErr {
		span.RecordError(c.err)
		return c
	}

	c.depResourceSets = make(DeploymentResourceSets, len(c.req.Deployments))

	var (
		mu      sync.Mutex
		errOnce sync.Once
	)

	deploymentsWithSelector := 0
	for _, dep := range c.req.Deployments {
		// Skip deployments with no selector - they match all env resources
		if dep.ResourceSelector == nil {
			continue
		}
		deploymentsWithSelector++

		c.depWg.Add(1)
		go func(dep *pb.Deployment) {
			defer c.depWg.Done()

			// Filter resources and build a set for O(1) lookup
			resources, err := getResourcesForDeployment(ctx, dep, c.req.Resources)
			if err != nil {
				errOnce.Do(func() {
					c.errMu.Lock()
					c.err = fmt.Errorf("failed to get resources for deployment %s: %w", dep.Id, err)
					c.errMu.Unlock()
					span.RecordError(c.err)
				})
				return
			}

			resourceSet := NewResourceIDSet(resources)
			mu.Lock()
			c.depResourceSets[dep.Id] = resourceSet
			mu.Unlock()
		}(dep)
	}

	span.SetAttributes(attribute.Int("deployments.with_selector", deploymentsWithSelector))

	return c
}

// Generate waits for filtering to complete, then generates and returns all release targets concurrently
func (c *Computation) Stream() (chan *pb.ReleaseTarget, error) {
	ctx, span := tracer.Start(c.ctx, "Stream")
	defer span.End()

	// Wait for both environment and deployment filtering to complete
	_, waitSpan := tracer.Start(ctx, "WaitForFiltering")
	c.envWg.Wait()
	c.depWg.Wait()
	waitSpan.End()

	// Check for errors after filtering completes
	c.errMu.Lock()
	err := c.err
	c.errMu.Unlock()
	
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	// Log filtering results
	totalEnvResources := 0
	for _, resourceSet := range c.envResourceSets {
		totalEnvResources += len(resourceSet)
	}
	totalDepResources := 0
	for _, resourceSet := range c.depResourceSets {
		totalDepResources += len(resourceSet)
	}
	span.SetAttributes(
		attribute.Int("env_resource_sets.total", totalEnvResources),
		attribute.Int("dep_resource_sets.total", totalDepResources),
	)

	// Build a map for O(1) resource lookups by ID
	resourceByID := make(map[string]*pb.Resource, len(c.req.Resources))
	for _, resource := range c.req.Resources {
		resourceByID[resource.Id] = resource
	}

	// Channel to collect release targets from concurrent workers
	targetChan := make(chan *pb.ReleaseTarget, 100)
	var wg sync.WaitGroup

	// Start workers to generate release targets concurrently
	workersStarted := 0
	for _, env := range c.req.Environments {
		envResourceSet := c.envResourceSets[env.Id]
		if len(envResourceSet) == 0 {
			continue
		}

		for _, dep := range c.req.Deployments {
			workersStarted++
			wg.Add(1)
			go func(env *pb.Environment, dep *pb.Deployment, envResourceSet ResourceIDSet) {
				defer wg.Done()

				// If deployment has no selector, all env resources match
				if dep.ResourceSelector == nil {
					generateAllReleaseTargets(ctx, env, dep, envResourceSet, resourceByID, targetChan)
					return
				}

				depResourceSet := c.depResourceSets[dep.Id]
				if len(depResourceSet) == 0 {
					return
				}

				generateMatchingReleaseTargets(ctx, env, dep, envResourceSet, depResourceSet, resourceByID, targetChan)
			}(env, dep, envResourceSet)
		}
	}

	span.SetAttributes(attribute.Int("workers.started", workersStarted))

	// Close the channel when all workers are done
	go func() {
		wg.Wait()
		close(targetChan)
	}()

	return targetChan, nil
}

// generateAllReleaseTargets creates release targets for all environment resources (used when deployment has no selector)
func generateAllReleaseTargets(
	ctx context.Context,
	env *pb.Environment,
	dep *pb.Deployment,
	envResourceSet ResourceIDSet,
	resourceByID map[string]*pb.Resource,
	targetChan chan<- *pb.ReleaseTarget,
) {
	_, span := tracer.Start(ctx, "generateAllReleaseTargets",
		trace.WithAttributes(
			attribute.String("environment.id", env.Id),
			attribute.String("deployment.id", dep.Id),
			attribute.Int("resources.count", len(envResourceSet)),
		))
	defer span.End()

	targetsGenerated := 0
	for resourceID := range envResourceSet {
		resource := resourceByID[resourceID]
		target := NewReleaseTargetBuilder().
			ForResource(resource).
			InEnvironment(env).
			WithDeployment(dep).
			Build()

		targetChan <- target
		targetsGenerated++
	}

	span.SetAttributes(attribute.Int("targets.generated", targetsGenerated))
}

// generateMatchingReleaseTargets finds resources common to an environment and deployment, then generates release targets
func generateMatchingReleaseTargets(
	ctx context.Context,
	env *pb.Environment,
	dep *pb.Deployment,
	envResourceSet ResourceIDSet,
	depResourceSet ResourceIDSet,
	resourceByID map[string]*pb.Resource,
	targetChan chan<- *pb.ReleaseTarget,
) {
	_, span := tracer.Start(ctx, "generateMatchingReleaseTargets",
		trace.WithAttributes(
			attribute.String("environment.id", env.Id),
			attribute.String("deployment.id", dep.Id),
			attribute.Int("env_resources.count", len(envResourceSet)),
			attribute.Int("dep_resources.count", len(depResourceSet)),
		))
	defer span.End()

	targetsGenerated := 0
	for resourceID := range envResourceSet {
		// Check if this resource is also in the deployment's resource set
		if !depResourceSet[resourceID] {
			continue
		}

		resource := resourceByID[resourceID]
		target := NewReleaseTargetBuilder().
			ForResource(resource).
			InEnvironment(env).
			WithDeployment(dep).
			Build()

		targetChan <- target
		targetsGenerated++
	}

	span.SetAttributes(attribute.Int("targets.generated", targetsGenerated))
}

// NewResourceIDSet creates a set of resource IDs for O(1) lookup
func NewResourceIDSet(resources []*pb.Resource) ResourceIDSet {
	resourceSet := make(ResourceIDSet, len(resources))
	for _, res := range resources {
		resourceSet[res.Id] = true
	}
	return resourceSet
}

// getResourcesForEnvironment returns resources for an environment based on its selector
// If environment has no selector, returns empty list
func getResourcesForEnvironment(ctx context.Context, env *pb.Environment, allResources []*pb.Resource) ([]*pb.Resource, error) {
	_, span := tracer.Start(ctx, "getResourcesForEnvironment",
		trace.WithAttributes(
			attribute.String("environment.id", env.Id),
			attribute.Bool("has_selector", env.ResourceSelector != nil),
		))
	defer span.End()

	if env.ResourceSelector == nil {
		span.SetAttributes(attribute.Int("resources.filtered", 0))
		return []*pb.Resource{}, nil
	}

	resources, err := filterResourcesBySelector(ctx, env.ResourceSelector.AsMap(), allResources)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	span.SetAttributes(attribute.Int("resources.filtered", len(resources)))
	return resources, nil
}

// getResourcesForDeployment returns resources for a deployment based on its selector
// If deployment has no selector, returns all resources
func getResourcesForDeployment(ctx context.Context, dep *pb.Deployment, allResources []*pb.Resource) ([]*pb.Resource, error) {
	_, span := tracer.Start(ctx, "getResourcesForDeployment",
		trace.WithAttributes(
			attribute.String("deployment.id", dep.Id),
			attribute.Bool("has_selector", dep.ResourceSelector != nil),
		))
	defer span.End()

	if dep.ResourceSelector == nil {
		span.SetAttributes(attribute.Int("resources.filtered", len(allResources)))
		return allResources, nil
	}

	resources, err := filterResourcesBySelector(ctx, dep.ResourceSelector.AsMap(), allResources)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	span.SetAttributes(attribute.Int("resources.filtered", len(resources)))
	return resources, nil
}

// filterResourcesBySelector filters resources based on a selector
func filterResourcesBySelector(
	ctx context.Context,
	selectorMap map[string]any,
	resources []*pb.Resource,
) ([]*pb.Resource, error) {
	_, span := tracer.Start(ctx, "filterResourcesBySelector",
		trace.WithAttributes(
			attribute.Int("resources.input", len(resources)),
		))
	defer span.End()

	unknownCondition, err := unknown.ParseFromMap(selectorMap)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to parse selector: %w", err)
	}
	
	filtered, err := selector.FilterResources(ctx, unknownCondition, resources)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	span.SetAttributes(attribute.Int("resources.output", len(filtered)))
	return filtered, nil
}
