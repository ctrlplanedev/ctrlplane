package purego

import (
	"context"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/resource"
	"workspace-engine/pkg/model/selector"
)

func (e *GoDispatcherEngine) LoadResource(ctx context.Context, in <-chan resource.Resource) (<-chan model.Match, error) {
	out := make(chan model.Match)

	go func() {
		defer close(out)
		for {
			select {
			case res, ok := <-in:
				if !ok {
					return
				}
				matches := e.UpsertResource(ctx, res)
				for _, match := range matches {
					select {
					case out <- match:
					case <-ctx.Done():
						return
					}
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	return out, nil
}

func (e *GoDispatcherEngine) LoadSelector(ctx context.Context, in <-chan selector.ResourceSelector) (<-chan model.Match, error) {
	out := make(chan model.Match)

	go func() {
		defer close(out)
		for {
			select {
			case sel, ok := <-in:
				if !ok {
					return
				}
				matches := e.UpsertSelector(ctx, sel)
				for _, match := range matches {
					select {
					case out <- match:
					case <-ctx.Done():
						return
					}
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	return out, nil
}

func (e *GoDispatcherEngine) RemoveResource(ctx context.Context, in <-chan resource.ResourceRef) (<-chan model.Status, error) {
	out := make(chan model.Status)

	go func() {
		defer close(out)
		for {
			select {
			case ref, ok := <-in:
				if !ok {
					return
				}
				statuses := e.RemoveResources(ctx, []resource.ResourceRef{ref})
				for _, status := range statuses {
					select {
					case out <- status:
					case <-ctx.Done():
						return
					}
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	return out, nil
}

func (e *GoDispatcherEngine) RemoveSelector(ctx context.Context, in <-chan selector.ResourceSelectorRef) (<-chan model.Status, error) {
	out := make(chan model.Status)

	go func() {
		defer close(out)
		for {
			select {
			case ref, ok := <-in:
				if !ok {
					return
				}
				statuses := e.RemoveSelectors(ctx, []selector.ResourceSelectorRef{ref})
				for _, status := range statuses {
					select {
					case out <- status:
					case <-ctx.Done():
						return
					}
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	return out, nil
}
