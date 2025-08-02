package selector

import (
	"fmt"
	"strings"
)

// ColumnOperator defines string matching operators
type ColumnOperator string

const (
	ColumnOperatorEquals     ColumnOperator = "equals"
	ColumnOperatorStartsWith ColumnOperator = "starts-with"
	ColumnOperatorEndsWith   ColumnOperator = "ends-with"
	ColumnOperatorContains   ColumnOperator = "contains"
)

// ValidateColumnOperator validates a column operator string
func ValidateColumnOperator(op string) error {
	switch ColumnOperator(op) {
	case ColumnOperatorEquals, ColumnOperatorStartsWith,
		ColumnOperatorEndsWith, ColumnOperatorContains:
		return nil
	default:
		return fmt.Errorf("invalid column operator: %s", op)
	}
}

func (c ColumnOperator) Test(resValue string, selValue string) (bool, error) {
	switch c {
	case ColumnOperatorEquals:
		return resValue == selValue, nil
	case ColumnOperatorStartsWith:
		return strings.HasPrefix(resValue, selValue), nil
	case ColumnOperatorEndsWith:
		return strings.HasSuffix(resValue, selValue), nil
	case ColumnOperatorContains:
		return strings.Contains(resValue, selValue), nil
	}
	return false, fmt.Errorf("invalid column operator: %s", c)
}
