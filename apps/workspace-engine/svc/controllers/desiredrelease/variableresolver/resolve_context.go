package variableresolver

import (
	"context"
	"workspace-engine/pkg/workspace/relationships/eval"
)

// resolveContext holds all pre-loaded data needed for a single Resolve call.
// This avoids repeated data loading and duplicate rule filtering.
type resolveContext struct {
	entity       *eval.EntityData
	rules        []eval.Rule
	candidates   []eval.EntityData
	candidateIdx map[string]*eval.EntityData
}

// resolveRelated finds the first entity matching a reference name by
// evaluating only the rules that apply to that reference.
func (rc *resolveContext) resolveRelated(ctx context.Context, reference string) (*eval.EntityData, error) {
	filtered := make([]eval.Rule, 0, len(rc.rules))
	for _, r := range rc.rules {
		if r.Reference == reference {
			filtered = append(filtered, r)
		}
	}
	if len(filtered) == 0 {
		return nil, nil
	}

	matches, err := eval.EvaluateRules(ctx, rc.entity, rc.candidates, filtered)
	if err != nil {
		return nil, err
	}

	for _, m := range matches {
		relatedID := m.ToEntityID
		relatedType := m.ToEntityType
		if m.ToEntityID == rc.entity.ID {
			relatedID = m.FromEntityID
			relatedType = m.FromEntityType
		}
		if c, ok := rc.candidateIdx[relatedType+"-"+relatedID.String()]; ok {
			return c, nil
		}
	}
	return nil, nil
}