package verification

import (
	"bytes"
	"fmt"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/templatefuncs"
)

// TemplateSpecs renders Go templates in the success and failure
// conditions of each verification spec using the job's dispatch context as
// template data. Conditions that contain no template directives are returned
// unchanged.
func TemplateSpecs(
	specs []oapi.VerificationMetricSpec,
	dispatchCtx *oapi.DispatchContext,
) ([]oapi.VerificationMetricSpec, error) {
	if dispatchCtx == nil || len(specs) == 0 {
		return specs, nil
	}

	ctxMap := dispatchCtx.Map()

	templated := make([]oapi.VerificationMetricSpec, len(specs))
	for i, spec := range specs {
		successCondition, err := renderString("successCondition", spec.SuccessCondition, ctxMap)
		if err != nil {
			return nil, fmt.Errorf("template success condition for spec %q: %w", spec.Name, err)
		}
		spec.SuccessCondition = successCondition

		if spec.FailureCondition != nil {
			failureCondition, err := renderString("failureCondition", *spec.FailureCondition, ctxMap)
			if err != nil {
				return nil, fmt.Errorf("template failure condition for spec %q: %w", spec.Name, err)
			}
			spec.FailureCondition = &failureCondition
		}

		templated[i] = spec
	}

	return templated, nil
}

func renderString(name, tmpl string, data map[string]any) (string, error) {
	t, err := templatefuncs.Parse(name, tmpl)
	if err != nil {
		return "", fmt.Errorf("parse template: %w", err)
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("execute template: %w", err)
	}
	return buf.String(), nil
}
