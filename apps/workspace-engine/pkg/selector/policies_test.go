package selector_test

import (
	"context"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"

	"github.com/stretchr/testify/assert"
)

func TestMatchPolicy_EmptySelector(t *testing.T) {
	policy := &oapi.Policy{Selector: ""}
	rt := selector.NewResolvedReleaseTarget(
		&oapi.Environment{Id: "e1", Name: "prod"},
		&oapi.Deployment{Id: "d1", Name: "web"},
		&oapi.Resource{Id: "r1", Name: "node1", Kind: "kubernetes"},
	)

	assert.True(t, selector.MatchPolicy(context.Background(), policy, rt))
}

func TestMatchPolicy_TrueSelector(t *testing.T) {
	policy := &oapi.Policy{Selector: "true"}
	rt := selector.NewResolvedReleaseTarget(
		&oapi.Environment{Id: "e1", Name: "prod"},
		&oapi.Deployment{Id: "d1", Name: "web"},
		&oapi.Resource{Id: "r1", Name: "node1", Kind: "kubernetes"},
	)

	assert.True(t, selector.MatchPolicy(context.Background(), policy, rt))
}

func TestMatchPolicy_MatchingDeploymentSelector(t *testing.T) {
	policy := &oapi.Policy{Selector: "deployment.name == 'web'"}
	rt := selector.NewResolvedReleaseTarget(
		&oapi.Environment{Id: "e1", Name: "prod"},
		&oapi.Deployment{Id: "d1", Name: "web"},
		&oapi.Resource{Id: "r1", Name: "node1", Kind: "kubernetes"},
	)

	assert.True(t, selector.MatchPolicy(context.Background(), policy, rt))
}

func TestMatchPolicy_NonMatchingDeploymentSelector(t *testing.T) {
	policy := &oapi.Policy{Selector: "deployment.name == 'api'"}
	rt := selector.NewResolvedReleaseTarget(
		&oapi.Environment{Id: "e1", Name: "prod"},
		&oapi.Deployment{Id: "d1", Name: "web"},
		&oapi.Resource{Id: "r1", Name: "node1", Kind: "kubernetes"},
	)

	assert.False(t, selector.MatchPolicy(context.Background(), policy, rt))
}

func TestMatchPolicy_MatchingEnvironmentSelector(t *testing.T) {
	policy := &oapi.Policy{Selector: "environment.name == 'prod'"}
	rt := selector.NewResolvedReleaseTarget(
		&oapi.Environment{Id: "e1", Name: "prod"},
		&oapi.Deployment{Id: "d1", Name: "web"},
		&oapi.Resource{Id: "r1", Name: "node1", Kind: "kubernetes"},
	)

	assert.True(t, selector.MatchPolicy(context.Background(), policy, rt))
}

func TestMatchPolicy_MatchingResourceSelector(t *testing.T) {
	policy := &oapi.Policy{Selector: "resource.kind == 'kubernetes'"}
	rt := selector.NewResolvedReleaseTarget(
		&oapi.Environment{Id: "e1", Name: "prod"},
		&oapi.Deployment{Id: "d1", Name: "web"},
		&oapi.Resource{Id: "r1", Name: "node1", Kind: "kubernetes"},
	)

	assert.True(t, selector.MatchPolicy(context.Background(), policy, rt))
}

func TestMatchPolicy_CombinedAndSelector(t *testing.T) {
	policy := &oapi.Policy{
		Selector: "deployment.name == 'web' && environment.name == 'prod' && resource.kind == 'kubernetes'",
	}
	rt := selector.NewResolvedReleaseTarget(
		&oapi.Environment{Id: "e1", Name: "prod"},
		&oapi.Deployment{Id: "d1", Name: "web"},
		&oapi.Resource{Id: "r1", Name: "node1", Kind: "kubernetes"},
	)

	assert.True(t, selector.MatchPolicy(context.Background(), policy, rt))
}

func TestMatchPolicy_CombinedAndSelector_PartialMismatch(t *testing.T) {
	policy := &oapi.Policy{
		Selector: "deployment.name == 'web' && environment.name == 'staging'",
	}
	rt := selector.NewResolvedReleaseTarget(
		&oapi.Environment{Id: "e1", Name: "prod"},
		&oapi.Deployment{Id: "d1", Name: "web"},
		&oapi.Resource{Id: "r1", Name: "node1", Kind: "kubernetes"},
	)

	assert.False(t, selector.MatchPolicy(context.Background(), policy, rt))
}

func TestMatchPolicy_OrSelector(t *testing.T) {
	policy := &oapi.Policy{
		Selector: "(deployment.name == 'web') || (deployment.name == 'api')",
	}
	rt := selector.NewResolvedReleaseTarget(
		&oapi.Environment{Id: "e1", Name: "prod"},
		&oapi.Deployment{Id: "d1", Name: "api"},
		&oapi.Resource{Id: "r1", Name: "node1", Kind: "kubernetes"},
	)

	assert.True(t, selector.MatchPolicy(context.Background(), policy, rt))
}

func TestMatchPolicy_InvalidCEL(t *testing.T) {
	policy := &oapi.Policy{Selector: "this is not valid CEL !!!"}
	rt := selector.NewResolvedReleaseTarget(
		&oapi.Environment{Id: "e1", Name: "prod"},
		&oapi.Deployment{Id: "d1", Name: "web"},
		&oapi.Resource{Id: "r1", Name: "node1", Kind: "kubernetes"},
	)

	assert.False(t, selector.MatchPolicy(context.Background(), policy, rt))
}

func TestMatchPolicy_NilEntities(t *testing.T) {
	policy := &oapi.Policy{Selector: "resource.kind == 'kubernetes'"}
	rt := selector.NewResolvedReleaseTarget(nil, nil, nil)

	// nil resource means the "resource" key is an empty map, so .kind lookup
	// returns "no such key" which is treated as false
	assert.False(t, selector.MatchPolicy(context.Background(), policy, rt))
}

func TestMatchPolicy_FalseSelector(t *testing.T) {
	policy := &oapi.Policy{Selector: "false"}
	rt := selector.NewResolvedReleaseTarget(
		&oapi.Environment{Id: "e1", Name: "prod"},
		&oapi.Deployment{Id: "d1", Name: "web"},
		&oapi.Resource{Id: "r1", Name: "node1", Kind: "kubernetes"},
	)

	assert.False(t, selector.MatchPolicy(context.Background(), policy, rt))
}

func TestMatchPolicy_ContainsFunction(t *testing.T) {
	policy := &oapi.Policy{Selector: "deployment.name.contains('web')"}
	rt := selector.NewResolvedReleaseTarget(
		&oapi.Environment{Id: "e1", Name: "prod"},
		&oapi.Deployment{Id: "d1", Name: "web-frontend"},
		&oapi.Resource{Id: "r1", Name: "node1", Kind: "kubernetes"},
	)

	assert.True(t, selector.MatchPolicy(context.Background(), policy, rt))
}

func TestMatchPolicy_OrSelector_NeitherMatches(t *testing.T) {
	policy := &oapi.Policy{
		Selector: "deployment.name == 'api' || deployment.name == 'worker'",
	}
	rt := selector.NewResolvedReleaseTarget(
		&oapi.Environment{Id: "e1", Name: "prod"},
		&oapi.Deployment{Id: "d1", Name: "web"},
		&oapi.Resource{Id: "r1", Name: "node1", Kind: "kubernetes"},
	)

	assert.False(t, selector.MatchPolicy(context.Background(), policy, rt))
}

func TestMatchPolicy_MetadataSelector(t *testing.T) {
	policy := &oapi.Policy{Selector: "resource.metadata.team == 'platform'"}
	rt := selector.NewResolvedReleaseTarget(
		&oapi.Environment{Id: "e1", Name: "prod"},
		&oapi.Deployment{Id: "d1", Name: "web"},
		&oapi.Resource{
			Id:       "r1",
			Name:     "node1",
			Kind:     "kubernetes",
			Metadata: map[string]string{"team": "platform"},
		},
	)

	assert.True(t, selector.MatchPolicy(context.Background(), policy, rt))
}
