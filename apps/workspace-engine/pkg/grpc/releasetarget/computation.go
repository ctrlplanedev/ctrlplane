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
	// Cache parsed selectors to avoid repeated JSON marshal/unmarshal overhead
	selectorCache   map[string]unknown.UnknownCondition
	selectorCacheMu sync.RWMutex
}

// NewComputation creates a new computation with the given context and request
func NewComputation(ctx context.Context, req *pb.ComputeReleaseTargetsRequest) *Computation {
	return &Computation{
		ctx:           ctx,
		req:           req,
		selectorCache: make(map[string]unknown.UnknownCondition),
	}
}

// FilterEnvironmentResources starts concurrent filtering of environment resources
// Does not wait - results will be ready when GenerateAndStream is called
func (c *Computation) FilterEnvironmentResources() *Computation {
	_, span := tracer.Start(c.ctx, "FilterEnvironmentResources",
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

			resources, err := c.getResourcesForEnvironment(env, c.req.Resources)
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
	_, span := tracer.Start(c.ctx, "FilterDeploymentResources",
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
			resources, err := c.getResourcesForDeployment(dep, c.req.Resources)
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

	// Calculate exact target count for each environment
	type envWork struct {
		env         *pb.Environment
		resourceIDs []string
		startIdx    int
		count       int
	}

	envWorkItems := make([]envWork, 0, len(c.req.Environments))
	totalTargets := 0

	for _, env := range c.req.Environments {
		envResourceSet := c.envResourceSets[env.Id]
		if len(envResourceSet) == 0 {
			continue
		}

		// Convert to slice once for faster iteration
		resourceIDs := make([]string, 0, len(envResourceSet))
		for resourceID := range envResourceSet {
			resourceIDs = append(resourceIDs, resourceID)
		}

		// Calculate exact count for this environment
		envCount := 0
		for _, dep := range c.req.Deployments {
			if dep.ResourceSelector == nil {
				envCount += len(resourceIDs)
			} else {
				depResourceSet := c.depResourceSets[dep.Id]
				// Count intersection
				for _, resourceID := range resourceIDs {
					if depResourceSet[resourceID] {
						envCount++
					}
				}
			}
		}

		if envCount > 0 {
			envWorkItems = append(envWorkItems, envWork{
				env:         env,
				resourceIDs: resourceIDs,
				startIdx:    totalTargets,
				count:       envCount,
			})
			totalTargets += envCount
		}
	}

	// Pre-allocate with exact size - no reallocation needed
	targets := make([]*pb.ReleaseTarget, totalTargets)
	var wg sync.WaitGroup

	// Process each environment in parallel with index-based writes (no locks!)
	for _, work := range envWorkItems {
		wg.Add(1)
		go func(work envWork) {
			defer wg.Done()

			idx := work.startIdx
			for _, dep := range c.req.Deployments {
				// Pre-build ID suffix once per env/dep pair (simple concatenation is fastest for short strings)
				idSuffix := ":" + work.env.Id + ":" + dep.Id

				// If deployment has no selector, all env resources match
				if dep.ResourceSelector == nil {
					for _, resourceID := range work.resourceIDs {
						resource := resourceByID[resourceID]
						targets[idx] = &pb.ReleaseTarget{
							Id:            resource.Id + idSuffix,
							ResourceId:    resource.Id,
							EnvironmentId: work.env.Id,
							DeploymentId:  dep.Id,
							Environment:   work.env,
							Deployment:    dep,
						}
						idx++
					}
					continue
				}

				depResourceSet := c.depResourceSets[dep.Id]
				if len(depResourceSet) == 0 {
					continue
				}

				// Write intersection directly to target indices
				for _, resourceID := range work.resourceIDs {
					if !depResourceSet[resourceID] {
						continue
					}
					resource := resourceByID[resourceID]
					targets[idx] = &pb.ReleaseTarget{
						Id:            resource.Id + idSuffix,
						ResourceId:    resource.Id,
						EnvironmentId: work.env.Id,
						DeploymentId:  dep.Id,
						Environment:   work.env,
						Deployment:    dep,
					}
					idx++
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
func (c *Computation) getResourcesForEnvironment(env *pb.Environment, allResources []*pb.Resource) ([]*pb.Resource, error) {
	_, span := tracer.Start(c.ctx, "getResourcesForEnvironment",
		trace.WithAttributes(
			attribute.String("environment.id", env.Id),
			attribute.Bool("has_selector", env.ResourceSelector != nil),
		))
	defer span.End()

	if env.ResourceSelector == nil {
		span.SetAttributes(attribute.Int("resources.filtered", 0))
		return []*pb.Resource{}, nil
	}

	resources, err := c.filterResourcesBySelector(env.Id, env.ResourceSelector.AsMap(), allResources)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	span.SetAttributes(attribute.Int("resources.filtered", len(resources)))
	return resources, nil
}

// getResourcesForDeployment returns resources for a deployment based on its selector
// If deployment has no selector, returns all resources
func (c *Computation) getResourcesForDeployment(dep *pb.Deployment, allResources []*pb.Resource) ([]*pb.Resource, error) {
	_, span := tracer.Start(c.ctx, "getResourcesForDeployment",
		trace.WithAttributes(
			attribute.String("deployment.id", dep.Id),
			attribute.Bool("has_selector", dep.ResourceSelector != nil),
		))
	defer span.End()

	if dep.ResourceSelector == nil {
		span.SetAttributes(attribute.Int("resources.filtered", len(allResources)))
		return allResources, nil
	}

	resources, err := c.filterResourcesBySelector(dep.Id, dep.ResourceSelector.AsMap(), allResources)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	span.SetAttributes(attribute.Int("resources.filtered", len(resources)))
	return resources, nil
}

// filterResourcesBySelector filters resources based on a selector with caching
func (c *Computation) filterResourcesBySelector(
	cacheKey string,
	selectorMap map[string]any,
	resources []*pb.Resource,
) ([]*pb.Resource, error) {
	_, span := tracer.Start(c.ctx, "filterResourcesBySelector",
		trace.WithAttributes(
			attribute.Int("resources.input", len(resources)),
			attribute.Bool("cached", false),
		))
	defer span.End()

	// Check cache first (read lock)
	c.selectorCacheMu.RLock()
	unknownCondition, cached := c.selectorCache[cacheKey]
	c.selectorCacheMu.RUnlock()

	if !cached {
		// Parse and cache (write lock)
		var err error
		unknownCondition, err = unknown.ParseFromMap(selectorMap)
		if err != nil {
			span.RecordError(err)
			return nil, fmt.Errorf("failed to parse selector: %w", err)
		}

		c.selectorCacheMu.Lock()
		c.selectorCache[cacheKey] = unknownCondition
		c.selectorCacheMu.Unlock()
	} else {
		span.SetAttributes(attribute.Bool("cached", true))
	}

	filtered, err := selector.FilterResources(c.ctx, unknownCondition, resources)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	span.SetAttributes(attribute.Int("resources.output", len(filtered)))
	return filtered, nil
}
