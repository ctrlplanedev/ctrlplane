package model

import (
	"context"
	"github.com/ctrlplanedev/selector-engine/pkg/model/resource"
	"github.com/ctrlplanedev/selector-engine/pkg/model/selector"
)

type Engine interface {
	// LoadResource processes resources via channels
	// Input: channel of resource.Resource
	// Output: channel of Match (0 or more per input)
	// Both channels will be closed when processing is complete
	LoadResource(ctx context.Context, in <-chan resource.Resource) (<-chan Match, error)

	// LoadSelector processes selectors via channels
	// Input: channel of selector.ResourceSelector
	// Output: channel of Match (0 or more per input)
	// Both channels will be closed when processing is complete
	LoadSelector(ctx context.Context, in <-chan selector.ResourceSelector) (<-chan Match, error)

	// RemoveResource removes resources via channels
	// Input: channel of resource.ResourceRef
	// Output: channel of Status
	// Both channels will be closed when processing is complete
	RemoveResource(ctx context.Context, in <-chan resource.ResourceRef) (<-chan Status, error)

	// RemoveSelector removes selectors via channels
	// Input: channel of selector.ResourceSelectorRef
	// Output: channel of Status
	// Both channels will be closed when processing is complete
	RemoveSelector(ctx context.Context, in <-chan selector.ResourceSelectorRef) (<-chan Status, error)
}

type Match struct {
	Error      bool                       `json:"error"`
	Message    string                     `json:"message"`
	SelectorID string                     `json:"selector_id,omitempty"`
	ResourceID string                     `json:"resource_id,omitempty"`
	Resource   *resource.Resource         `json:"resource,omitempty"`
	Selector   *selector.ResourceSelector `json:"selector,omitempty"`
}

type Status struct {
	Error   bool   `json:"error"`
	Message string `json:"message"`
}