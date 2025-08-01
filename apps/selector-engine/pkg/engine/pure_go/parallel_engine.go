package purego

import (
	"context"
	"github.com/ctrlplanedev/selector-engine/pkg/model"
	"github.com/ctrlplanedev/selector-engine/pkg/model/resource"
	"github.com/ctrlplanedev/selector-engine/pkg/model/selector"
	"sync"
)

const (
	// DefaultMaxParallelCalls is the default maximum number of parallel calls to the engine
	DefaultMaxParallelCalls = 10
)

// GoParallelDispatcherEngine wraps GoDispatcherEngine with parallel processing capabilities
type GoParallelDispatcherEngine struct {
	baseEngine       *GoDispatcherEngine
	maxParallelCalls int
}

// NewGoParallelDispatcherEngine creates a new parallel dispatcher engine
func NewGoParallelDispatcherEngine(maxParallelCalls int) *GoParallelDispatcherEngine {
	if maxParallelCalls <= 0 {
		maxParallelCalls = DefaultMaxParallelCalls
	}
	return &GoParallelDispatcherEngine{
		baseEngine:       NewGoDispatcherEngine(),
		maxParallelCalls: maxParallelCalls,
	}
}

// LoadResource implements the Engine interface with parallel processing and backpressure
func (e *GoParallelDispatcherEngine) LoadResource(ctx context.Context, in <-chan resource.Resource) (<-chan model.Match, error) {
	out := make(chan model.Match)
	
	semaphore := make(chan struct{}, e.maxParallelCalls)
	
	var wg sync.WaitGroup
	
	processResource := func(res resource.Resource) {
		defer wg.Done()
		defer func() { <-semaphore }()
		
		matches := e.baseEngine.UpsertResource(ctx, res)
		for _, match := range matches {
			select {
			case out <- match:
			case <-ctx.Done():
				return
			}
		}
	}
	
	go func() {
		defer close(out)
		
		for {
			select {
			case res, ok := <-in:
				if !ok {
					wg.Wait()
					return
				}
				
				select {
				case semaphore <- struct{}{}:
					wg.Add(1)
					go processResource(res)
				case <-ctx.Done():
					wg.Wait()
					return
				}
				
			case <-ctx.Done():
				wg.Wait()
				return
			}
		}
	}()
	
	return out, nil
}

// LoadSelector implements the Engine interface with parallel processing and backpressure
func (e *GoParallelDispatcherEngine) LoadSelector(ctx context.Context, in <-chan selector.ResourceSelector) (<-chan model.Match, error) {
	out := make(chan model.Match)
	
	semaphore := make(chan struct{}, e.maxParallelCalls)
	
	var wg sync.WaitGroup
	
	processSelector := func(sel selector.ResourceSelector) {
		defer wg.Done()
		defer func() { <-semaphore }()
		
		matches := e.baseEngine.UpsertSelector(ctx, sel)
		for _, match := range matches {
			select {
			case out <- match:
			case <-ctx.Done():
				return
			}
		}
	}
	
	go func() {
		defer close(out)
		
		for {
			select {
			case sel, ok := <-in:
				if !ok {
					wg.Wait()
					return
				}
				
				select {
				case semaphore <- struct{}{}:
					wg.Add(1)
					go processSelector(sel)
				case <-ctx.Done():
					wg.Wait()
					return
				}
				
			case <-ctx.Done():
				wg.Wait()
				return
			}
		}
	}()
	
	return out, nil
}

// RemoveResource implements the Engine interface with parallel processing and backpressure
func (e *GoParallelDispatcherEngine) RemoveResource(ctx context.Context, in <-chan resource.ResourceRef) (<-chan model.Status, error) {
	out := make(chan model.Status)
	
	semaphore := make(chan struct{}, e.maxParallelCalls)
	
	var wg sync.WaitGroup
	
	processRemoval := func(ref resource.ResourceRef) {
		defer wg.Done()
		defer func() { <-semaphore }()
		
		statuses := e.baseEngine.RemoveResources(ctx, []resource.ResourceRef{ref})
		for _, status := range statuses {
			select {
			case out <- status:
			case <-ctx.Done():
				return
			}
		}
	}
	
	go func() {
		defer close(out)
		
		for {
			select {
			case ref, ok := <-in:
				if !ok {
					wg.Wait()
					return
				}
				
				select {
				case semaphore <- struct{}{}:
					wg.Add(1)
					go processRemoval(ref)
				case <-ctx.Done():
					wg.Wait()
					return
				}
				
			case <-ctx.Done():
				wg.Wait()
				return
			}
		}
	}()
	
	return out, nil
}

// RemoveSelector implements the Engine interface with parallel processing and backpressure
func (e *GoParallelDispatcherEngine) RemoveSelector(ctx context.Context, in <-chan selector.ResourceSelectorRef) (<-chan model.Status, error) {
	out := make(chan model.Status)
	
	semaphore := make(chan struct{}, e.maxParallelCalls)
	
	var wg sync.WaitGroup
	
	processRemoval := func(ref selector.ResourceSelectorRef) {
		defer wg.Done()
		defer func() { <-semaphore }()
		
		statuses := e.baseEngine.RemoveSelectors(ctx, []selector.ResourceSelectorRef{ref})
		for _, status := range statuses {
			select {
			case out <- status:
			case <-ctx.Done():
				return
			}
		}
	}
	
	go func() {
		defer close(out)
		
		for {
			select {
			case ref, ok := <-in:
				if !ok {
					wg.Wait()
					return
				}
				
				select {
				case semaphore <- struct{}{}:
					wg.Add(1)
					go processRemoval(ref)
				case <-ctx.Done():
					wg.Wait()
					return
				}
				
			case <-ctx.Done():
				wg.Wait()
				return
			}
		}
	}()
	
	return out, nil
}