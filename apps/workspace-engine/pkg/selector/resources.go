package selector

import (
	"context"

	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/oapi"
)

type Selector any

func FilterResources(ctx context.Context, sel *oapi.Selector, resources []*oapi.Resource, opts ...FilterOption) (map[string]*oapi.Resource, error) {
	// Use the generic Filter function
	matchedSlice, err := Filter(ctx, sel, resources, opts...)
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

func Filter[T any](ctx context.Context, sel *oapi.Selector, resources []T, opts ...FilterOption) ([]T, error) {
	// If no selector is provided, return empty slice
	if sel == nil {
		return []T{}, nil
	}

	// Apply options
	options := &FilterOptions{
		chunkSize:      100,
		maxConcurrency: 0,
		useChunking:    false,
	}
	for _, opt := range opts {
		opt(options)
	}

	selector, err := Matchable(ctx, sel)
	if err != nil {
		return nil, err
	}

	// Use chunked processing if enabled
	if options.useChunking {
		type filterResult struct {
			item    T
			matched bool
		}

		results, err := concurrency.ProcessInChunks(
			resources,
			options.chunkSize,
			options.maxConcurrency,
			func(item T) (filterResult, error) {
				matched, err := selector.Matches(item)
				if err != nil {
					return filterResult{}, err
				}
				return filterResult{item: item, matched: matched}, nil
			},
		)
		if err != nil {
			return nil, err
		}

		// Filter out non-matching items
		matchedResources := make([]T, 0, len(results)/2)
		for _, result := range results {
			if result.matched {
				matchedResources = append(matchedResources, result.item)
			}
		}
		return matchedResources, nil
	}

	// Sequential processing (default)
	// Pre-allocate with reasonable capacity (assume ~50% match rate to minimize reallocations)
	// This avoids multiple slice reallocations during append
	estimatedCapacity := max(len(resources)/2, 128)
	matchedResources := make([]T, 0, estimatedCapacity)

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
