package relationships

import (
	"strings"
	"workspace-engine/pkg/oapi"
)

func NewPropertyMatcher(pm *oapi.PropertyMatcher) *PropertyMatcher {
	if pm.Operator == "" {
		pm.Operator = "equals"
	}
	return &PropertyMatcher{
		PropertyMatcher: pm,
	}
}

// PropertyMatcher evaluates property matching between two entities
type PropertyMatcher struct {
	*oapi.PropertyMatcher
}

func (m *PropertyMatcher) Evaluate(from any, to any) bool {
	fromValue, err := GetPropertyValue(from, m.FromProperty)
	if err != nil {
		return false
	}
	toValue, err := GetPropertyValue(to, m.ToProperty)
	if err != nil {
		return false
	}

	fromValueStr := extractValueAsString(fromValue)
	toValueStr := extractValueAsString(toValue)

	operator := strings.ToLower(strings.TrimSpace(string(m.Operator)))
	switch operator {
	case "equals":
		return fromValueStr == toValueStr
	case "not_equals", "notequals":
		return fromValueStr != toValueStr
	case "contains", "contain":
		return strings.Contains(fromValueStr, toValueStr)
	case "starts_with", "startswith":
		return strings.HasPrefix(fromValueStr, toValueStr)
	case "ends_with", "endswith":
		return strings.HasSuffix(fromValueStr, toValueStr)
	}
	return true
}
