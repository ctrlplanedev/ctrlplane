package creators

import (
	"workspace-engine/pkg/oapi"
)

// NewResourceMatchAllSelector creates a selector that matches all resources
func NewResourceMatchAllSelector() *oapi.Selector {
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	return selector
}

// NewResourceCelSelector creates a selector with a custom CEL expression
func NewResourceCelSelector(cel string) *oapi.Selector {
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: cel})
	return selector
}

// NewResourceJsonSelector creates a selector with a JSON selector
func NewResourceJsonSelector(jsonSelector map[string]any) *oapi.Selector {
	selector := &oapi.Selector{}
	_ = selector.FromJsonSelector(oapi.JsonSelector{Json: jsonSelector})
	return selector
}
