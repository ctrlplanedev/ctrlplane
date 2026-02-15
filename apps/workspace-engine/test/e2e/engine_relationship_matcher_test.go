package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/test/integration"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// TestEngine_RelationshipMatcher_CelMetadataEquals tests relationship matching
// using CEL expressions with metadata equality.
func TestEngine_RelationshipMatcher_CelMetadataEquals(t *testing.T) {
	ruleID := uuid.New().String()
	r1ID := uuid.New().String()
	r2ID := uuid.New().String()
	r3ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(ruleID),
			integration.RelationshipRuleName("region-match"),
			integration.RelationshipRuleReference("associated"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("associated"),
			integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
			integration.RelationshipRuleToCelSelector("resource.kind == 'cluster'"),
			integration.WithCelMatcher("from.metadata.region == to.metadata.region"),
		),
		integration.WithResource(
			integration.ResourceID(r1ID),
			integration.ResourceName("vpc-east"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{"region": "us-east-1"}),
		),
		integration.WithResource(
			integration.ResourceID(r2ID),
			integration.ResourceName("cluster-east"),
			integration.ResourceKind("cluster"),
			integration.ResourceMetadata(map[string]string{"region": "us-east-1"}),
		),
		integration.WithResource(
			integration.ResourceID(r3ID),
			integration.ResourceName("cluster-west"),
			integration.ResourceKind("cluster"),
			integration.ResourceMetadata(map[string]string{"region": "us-west-2"}),
		),
	)

	ctx := context.Background()

	vpc, _ := engine.Workspace().Resources().Get(r1ID)
	entity := relationships.NewResourceEntity(vpc)

	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	assert.NoError(t, err)

	// Should have relationship with cluster-east (same region) but not cluster-west
	found := false
	for _, entities := range relatedEntities {
		for _, related := range entities {
			if related.EntityId == r2ID {
				found = true
			}
			assert.NotEqual(t, r3ID, related.EntityId)
		}
	}
	assert.True(t, found, "vpc should be related to cluster in same region")
}

// TestEngine_RelationshipMatcher_CelCompoundCondition tests matching with
// compound CEL conditions.
func TestEngine_RelationshipMatcher_CelCompoundCondition(t *testing.T) {
	ruleID := uuid.New().String()
	r1ID := uuid.New().String()
	r2ID := uuid.New().String()
	r3ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(ruleID),
			integration.RelationshipRuleName("multi-match"),
			integration.RelationshipRuleReference("associated"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("associated"),
			integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
			integration.RelationshipRuleToCelSelector("resource.kind == 'subnet'"),
			integration.WithCelMatcher("from.metadata.region == to.metadata.region && from.metadata.account == to.metadata.account"),
		),
		integration.WithResource(
			integration.ResourceID(r1ID),
			integration.ResourceName("vpc-east"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region":  "us-east-1",
				"account": "prod",
			}),
		),
		integration.WithResource(
			integration.ResourceID(r2ID),
			integration.ResourceName("subnet-east-prod"),
			integration.ResourceKind("subnet"),
			integration.ResourceMetadata(map[string]string{
				"region":  "us-east-1",
				"account": "prod",
			}),
		),
		integration.WithResource(
			integration.ResourceID(r3ID),
			integration.ResourceName("subnet-east-staging"),
			integration.ResourceKind("subnet"),
			integration.ResourceMetadata(map[string]string{
				"region":  "us-east-1",
				"account": "staging",
			}),
		),
	)

	ctx := context.Background()

	vpc, _ := engine.Workspace().Resources().Get(r1ID)
	entity := relationships.NewResourceEntity(vpc)

	relatedEntities, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	assert.NoError(t, err)

	assoc, ok := relatedEntities["associated"]
	assert.True(t, ok)
	if ok {
		foundProd := false
		foundStaging := false
		for _, related := range assoc {
			if related.EntityId == r2ID {
				foundProd = true
			}
			if related.EntityId == r3ID {
				foundStaging = true
			}
		}
		assert.True(t, foundProd, "should match subnet in same region+account")
		assert.False(t, foundStaging, "should not match subnet in different account")
	}
}

// TestEngine_RelationshipMatcher_NewResourceTriggersMatching tests that adding
// a new resource triggers relationship matching against existing rules.
func TestEngine_RelationshipMatcher_NewResourceTriggersMatching(t *testing.T) {
	ruleID := uuid.New().String()
	r1ID := uuid.New().String()
	r2ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(ruleID),
			integration.RelationshipRuleName("svc-db"),
			integration.RelationshipRuleReference("depends-on"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("depends-on"),
			integration.RelationshipRuleFromCelSelector("resource.kind == 'service'"),
			integration.RelationshipRuleToCelSelector("resource.kind == 'database'"),
			integration.WithCelMatcher("from.metadata.db == to.name"),
		),
		integration.WithResource(
			integration.ResourceID(r1ID),
			integration.ResourceName("api-svc"),
			integration.ResourceKind("service"),
			integration.ResourceMetadata(map[string]string{"db": "main-db"}),
		),
	)

	ctx := context.Background()

	// Before adding the database, no relationships for the service
	svc, _ := engine.Workspace().Resources().Get(r1ID)
	entity := relationships.NewResourceEntity(svc)
	related, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	assert.NoError(t, err)

	// Add a matching database via event
	newDB := &oapi.Resource{
		Id:       r2ID,
		Name:     "main-db",
		Kind:     "database",
		Metadata: map[string]string{},
	}
	engine.PushEvent(ctx, handler.ResourceCreate, newDB)

	// Now the service should find the database
	svc, _ = engine.Workspace().Resources().Get(r1ID)
	entity = relationships.NewResourceEntity(svc)
	related, err = engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	assert.NoError(t, err)
	assert.NotEmpty(t, related, "should find newly created resource as related")
}

// TestEngine_RelationshipMatcher_RuleUpdate tests that updating a relationship rule
// via event triggers relationship re-evaluation.
func TestEngine_RelationshipMatcher_RuleUpdate(t *testing.T) {
	ruleID := uuid.New().String()
	r1ID := uuid.New().String()
	r2ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(ruleID),
			integration.RelationshipRuleName("app-link"),
			integration.RelationshipRuleReference("linked"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("linked"),
			integration.RelationshipRuleFromCelSelector("resource.kind == 'frontend'"),
			integration.RelationshipRuleToCelSelector("resource.kind == 'backend'"),
			integration.WithCelMatcher("from.metadata.app == to.metadata.app"),
		),
		integration.WithResource(
			integration.ResourceID(r1ID),
			integration.ResourceName("web"),
			integration.ResourceKind("frontend"),
			integration.ResourceMetadata(map[string]string{"app": "myapp"}),
		),
		integration.WithResource(
			integration.ResourceID(r2ID),
			integration.ResourceName("api"),
			integration.ResourceKind("backend"),
			integration.ResourceMetadata(map[string]string{"app": "myapp"}),
		),
	)

	ctx := context.Background()

	// Verify initial relationship
	r1, _ := engine.Workspace().Resources().Get(r1ID)
	entity := relationships.NewResourceEntity(r1)
	related, err := engine.Workspace().RelationshipRules().GetRelatedEntities(ctx, entity)
	assert.NoError(t, err)
	assert.NotEmpty(t, related)

	// Update the rule via event
	rule, _ := engine.Workspace().RelationshipRules().Get(ruleID)
	rule.Name = "updated-app-link"
	engine.PushEvent(ctx, handler.RelationshipRuleUpdate, rule)

	// Verify rule was updated
	updatedRule, ok := engine.Workspace().RelationshipRules().Get(ruleID)
	assert.True(t, ok)
	assert.Equal(t, "updated-app-link", updatedRule.Name)
}
