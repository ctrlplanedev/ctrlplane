package oapi

// PlanValidationRule defines the rule for validating plan results with OPA/Rego.
type PlanValidationRule struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Rego        string `json:"rego"`
	Severity    string `json:"severity"`
}
