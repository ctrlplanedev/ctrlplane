package relationships

import (
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

// // Matches checks if two entities match according to this property matcher
// func (pm *PropertyMatcher) Matches(fromEntity, toEntity any) (bool, error) {
// 	// Extract property values from both entities
// 	fromValue, err := GetPropertyValue(fromEntity, pm.FromProperty)
// 	if err != nil {
// 		// If property doesn't exist, it's not a match (not an error)
// 		return false, nil
// 	}

// 	toValue, err := GetPropertyValue(toEntity, pm.ToProperty)
// 	if err != nil {
// 		// If property doesn't exist, it's not a match (not an error)
// 		return false, nil
// 	}

// 	// Convert both values to strings for comparison
// 	fromStr, err := GetPropertyValueAsString(fromValue)
// 	if err != nil {
// 		return false, nil
// 	}

// 	toStr, err := GetPropertyValueAsString(toValue)
// 	if err != nil {
// 		return false, nil
// 	}

// 	// Perform the comparison based on the operator
// 	return pm.compareValues(fromStr, toStr)
// }

// // compareValues compares two string values using the specified operator
// func (pm *PropertyMatcher) compareValues(from, to string) (bool, error) {
// 	switch pm.Operator {
// 	case "equals":
// 		return from == to, nil
// 	case "not_equals":
// 		return from != to, nil
// 	case "contains":
// 		return strings.Contains(from, to) || strings.Contains(to, from), nil
// 	case "starts_with":
// 		return strings.HasPrefix(from, to) || strings.HasPrefix(to, from), nil
// 	case "ends_with":
// 		return strings.HasSuffix(from, to) || strings.HasSuffix(to, from), nil
// 	case "regex":
// 		// Try matching in both directions
// 		matched1, err := regexp.MatchString(to, from)
// 		if err == nil && matched1 {
// 			return true, nil
// 		}
// 		matched2, err := regexp.MatchString(from, to)
// 		if err != nil {
// 			return false, fmt.Errorf("invalid regex pattern: %w", err)
// 		}
// 		return matched2, nil
// 	default:
// 		return false, fmt.Errorf("unsupported operator: %s", pm.Operator)
// 	}
// }

// // MatchesAllPropertyMatchers checks if two entities match ALL property matchers
// func MatchesAllPropertyMatchers(fromEntity, toEntity any, matchers []*PropertyMatcher) (bool, error) {
// 	// If no matchers, always match (Cartesian product)
// 	if len(matchers) == 0 {
// 		return true, nil
// 	}

// 	// All matchers must match
// 	for _, matcher := range matchers {
// 		matches, err := matcher.Matches(fromEntity, toEntity)
// 		if err != nil {
// 			return false, err
// 		}
// 		if !matches {
// 			return false, nil
// 		}
// 	}

// 	return true, nil
// }

// // ConvertPropertyMatchers converts protobuf PropertyMatchers to our internal type
// func ConvertPropertyMatchers(pbMatchers []*pb.PropertyMatcher) []*PropertyMatcher {
// 	matchers := make([]*PropertyMatcher, len(pbMatchers))
// 	for i, pm := range pbMatchers {
// 		matchers[i] = NewPropertyMatcherFromProto(pm)
// 	}
// 	return matchers
// }

