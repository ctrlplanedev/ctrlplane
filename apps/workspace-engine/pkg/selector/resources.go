package selector

import (
	"context"

	"workspace-engine/pkg/oapi"
)

type Selector any

func FilterResources(ctx context.Context, sel *oapi.Selector, resources []*oapi.Resource, _opts ...FilterOption) (map[string]*oapi.Resource, error) {
	// Use the generic Filter function
	matchedSlice, err := Filter(ctx, sel, resources)
	if err != nil {
		return nil, err
	}

	// Convert slice to map keyed by resource ID
	matchedResources := make(map[string]*oapi.Resource, len(matchedSlice))
	for _, resource := range matchedSlice {
		matchedResources[resource.Id] = resource
	}

	return matchedResources, nil
}

// FilterOptions contains configuration options for the Filter function
type FilterOptions struct {
	chunkSize      int
	maxConcurrency int
	useChunking    bool
}

// FilterOption is a function that modifies FilterOptions
type FilterOption func(*FilterOptions)

// WithChunking enables parallel processing with chunking
// chunkSize: number of items to process in each chunk
// maxConcurrency: maximum number of goroutines running concurrently (0 = unbounded)
func WithChunking(chunkSize, maxConcurrency int) FilterOption {
	return func(opts *FilterOptions) {
		opts.useChunking = true
		opts.chunkSize = chunkSize
		opts.maxConcurrency = maxConcurrency
	}
}

// FilterSimple performs raw sequential filtering without any concurrency or optimizations.
// This is a simplified version of Filter that just does the basic computation.
func Filter[T any](ctx context.Context, sel *oapi.Selector, resources []T, _opts ...FilterOption) ([]T, error) {
	// If no selector is provided, return empty slice
	if sel == nil {
		return []T{}, nil
	}

	selector, err := Matchable(ctx, sel)
	if err != nil {
		return nil, err
	}

	matchedResources := make([]T, 0)

	for _, resource := range resources {
		matched, err := selector.Matches(resource)
		if err != nil {
			return nil, err
		}
		if matched {
			matchedResources = append(matchedResources, resource)
		}
	}

	return matchedResources, nil
}
