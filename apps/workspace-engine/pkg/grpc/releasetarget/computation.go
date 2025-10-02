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

// Generate waits for filtering and returns all release targets as a slice
func (c *Computation) Generate() ([]*pb.ReleaseTarget, error) {
	_, span := tracer.Start(c.ctx, "Generate")
	defer span.End()

	// Wait for both environment and deployment filtering to complete
	c.envWg.Wait()
	c.depWg.Wait()

	// Check for errors after filtering completes
	c.errMu.Lock()
	err := c.err
	c.errMu.Unlock()

	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	// Build a map for O(1) resource lookups by ID
	resourceByID := make(map[string]*pb.Resource, len(c.req.Resources))
	for _, resource := range c.req.Resources {
		resourceByID[resource.Id] = resource
	}

	targets := make([]*pb.ReleaseTarget, 0, len(c.req.Environments)*len(c.req.Deployments))
	var wg sync.WaitGroup

	// Process each environment in parallel with index-based writes (no locks!)
	for _, work := range c.req.Environments {
		wg.Add(1)
		go func(env *pb.Environment) {
			defer wg.Done()

			envResources := c.envResourceSets[env.Id]
			for _, dep := range c.req.Deployments {
				deploymentResources := c.depResourceSets[dep.Id]
				// Pre-build ID suffix once per env/dep pair (simple concatenation is fastest for short strings)
				idSuffix := ":" + env.Id + ":" + dep.Id

				// If deployment has no selector, all env resources match
				if dep.ResourceSelector == nil {
					for resourceID := range envResources {
						resource := resourceByID[resourceID]
						targets = append(targets, &pb.ReleaseTarget{
							Id:            resource.Id + idSuffix,
							ResourceId:    resource.Id,
							EnvironmentId: env.Id,
							DeploymentId:  dep.Id,
						})
					}
					continue
				}

				depResourceSet := c.depResourceSets[dep.Id]
				if len(depResourceSet) == 0 {
					continue
				}

				for resourceID := range depResourceSet {
					if _, has := deploymentResources[resourceID]; !has {
						continue
					}
					if _, has := envResources[resourceID]; !has {
						continue
					}
					resource := resourceByID[resourceID]
					targets = append(targets, &pb.ReleaseTarget{
						Id:            resource.Id + idSuffix,
						ResourceId:    resource.Id,
						EnvironmentId: env.Id,
						DeploymentId:  dep.Id,
					})
				}
			}
		}(work)
	}

	wg.Wait()
	span.SetAttributes(attribute.Int("targets.generated", len(targets)))

	return targets, nil
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
	if env.ResourceSelector == nil {
		return []*pb.Resource{}, nil
	}

	resources, err := filterResourcesBySelector(ctx, env.ResourceSelector.AsMap(), allResources)
	if err != nil {
		return nil, err
	}

	return resources, nil
}

// getResourcesForDeployment returns resources for a deployment based on its selector
// If deployment has no selector, returns all resources
func getResourcesForDeployment(ctx context.Context, dep *pb.Deployment, allResources []*pb.Resource) ([]*pb.Resource, error) {
	if dep.ResourceSelector == nil {
		return allResources, nil
	}

	resources, err := filterResourcesBySelector(ctx, dep.ResourceSelector.AsMap(), allResources)
	if err != nil {
		return nil, err
	}

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
