package relationships

import (
	"strings"
	"workspace-engine/pkg/pb"
)

// PropertyMatcher evaluates property matching between two entities
type PropertyMatcher struct {
	FromProperty []string
	ToProperty   []string
	Operator     string
}

// NewPropertyMatcherFromProto creates a PropertyMatcher from a protobuf PropertyMatcher
func NewPropertyMatcherFromProto(pm *pb.PropertyMatcher) *PropertyMatcher {
	operator := "equals"
	if pm.Operator != nil {
		operator = *pm.Operator
	}

	return &PropertyMatcher{
		FromProperty: pm.FromProperty,
		ToProperty:   pm.ToProperty,
		Operator:     operator,
	}
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

	op := strings.ToLower(m.Operator)

	switch op {
	case "equals":
		return fromValue == toValue
	case "not_equals", "notequals":
		return fromValue != toValue
	case "contains", "contain":
		return strings.Contains(fromValueStr, toValueStr)
	case "starts_with", "startswith":
		return strings.HasPrefix(fromValueStr, toValueStr)
	case "ends_with", "endswith":
		return strings.HasSuffix(fromValueStr, toValueStr)
	}
	return true
}
