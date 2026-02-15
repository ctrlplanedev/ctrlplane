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

func TestEngine_RelationsStore_GetRelatableEntities(t *testing.T) {
	r1ID := uuid.New().String()
	d1ID := uuid.New().String()
	e1ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(d1ID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e1ID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(r1ID),
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	entities := engine.Workspace().Relations().GetRelatableEntities(ctx)
	assert.NotEmpty(t, entities)

	// Should contain resource, deployment, and environment
	hasResource := false
	hasDeployment := false
	hasEnvironment := false
	for _, entity := range entities {
		switch entity.GetType() {
		case "resource":
			hasResource = true
		case "deployment":
			hasDeployment = true
		case "environment":
			hasEnvironment = true
		}
	}
	assert.True(t, hasResource)
	assert.True(t, hasDeployment)
	assert.True(t, hasEnvironment)
}

func TestEngine_RelationsStore_UpsertAndQuery(t *testing.T) {
	ruleID := uuid.New().String()
	r1ID := uuid.New().String()
	r2ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(ruleID),
			integration.RelationshipRuleName("link"),
			integration.RelationshipRuleReference("contains"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("contains"),
			integration.RelationshipRuleFromCelSelector("resource.kind == 'vpc'"),
			integration.RelationshipRuleToCelSelector("resource.kind == 'subnet'"),
			integration.WithCelMatcher("from.metadata.id == to.metadata.id"),
		),
		integration.WithResource(
			integration.ResourceID(r1ID),
			integration.ResourceName("vpc-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{"id": "v1"}),
		),
		integration.WithResource(
			integration.ResourceID(r2ID),
			integration.ResourceName("subnet-1"),
			integration.ResourceKind("subnet"),
			integration.ResourceMetadata(map[string]string{"id": "v1"}),
		),
	)

	ctx := context.Background()

	// Manually upsert a relation via the Relations store to exercise Upsert/Get/ForRule/Items
	rule, _ := engine.Workspace().RelationshipRules().Get(ruleID)
	r1, _ := engine.Workspace().Resources().Get(r1ID)
	r2, _ := engine.Workspace().Resources().Get(r2ID)

	relation := &relationships.EntityRelation{
		Rule: rule,
		From: relationships.NewResourceEntity(r1),
		To:   relationships.NewResourceEntity(r2),
	}

	err := engine.Workspace().Relations().Upsert(ctx, relation)
	assert.NoError(t, err)

	// Verify Get()
	got, ok := engine.Workspace().Relations().Get(relation.Key())
	assert.True(t, ok)
	assert.Equal(t, ruleID, got.Rule.Id)

	// Verify Items()
	items := engine.Workspace().Relations().Items()
	assert.NotEmpty(t, items)

	// Verify ForRule()
	forRule := engine.Workspace().Relations().ForRule(rule)
	assert.NotEmpty(t, forRule)
	assert.Equal(t, ruleID, forRule[0].Rule.Id)

	// Verify ForEntity()
	entity := relationships.NewResourceEntity(r1)
	forEntity := engine.Workspace().Relations().ForEntity(entity)
	assert.NotEmpty(t, forEntity)

	// Verify Remove()
	engine.Workspace().Relations().Remove(relation.Key())
	_, ok = engine.Workspace().Relations().Get(relation.Key())
	assert.False(t, ok)
}

func TestEngine_RelationsStore_RemoveForRule(t *testing.T) {
	ruleID := uuid.New().String()
	r1ID := uuid.New().String()
	r2ID := uuid.New().String()
	r3ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(ruleID),
			integration.RelationshipRuleName("link"),
			integration.RelationshipRuleReference("linked"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("linked"),
			integration.RelationshipRuleFromCelSelector("resource.kind == 'svc'"),
			integration.RelationshipRuleToCelSelector("resource.kind == 'db'"),
			integration.WithCelMatcher("from.metadata.app == to.metadata.app"),
		),
		integration.WithResource(
			integration.ResourceID(r1ID),
			integration.ResourceKind("svc"),
			integration.ResourceMetadata(map[string]string{"app": "x"}),
		),
		integration.WithResource(
			integration.ResourceID(r2ID),
			integration.ResourceKind("db"),
			integration.ResourceMetadata(map[string]string{"app": "x"}),
		),
		integration.WithResource(
			integration.ResourceID(r3ID),
			integration.ResourceKind("db"),
			integration.ResourceMetadata(map[string]string{"app": "y"}),
		),
	)

	ctx := context.Background()

	rule, _ := engine.Workspace().RelationshipRules().Get(ruleID)
	r1, _ := engine.Workspace().Resources().Get(r1ID)
	r2, _ := engine.Workspace().Resources().Get(r2ID)

	// Manually upsert
	rel := &relationships.EntityRelation{
		Rule: rule,
		From: relationships.NewResourceEntity(r1),
		To:   relationships.NewResourceEntity(r2),
	}
	_ = engine.Workspace().Relations().Upsert(ctx, rel)

	forRule := engine.Workspace().Relations().ForRule(rule)
	assert.Len(t, forRule, 1)

	// RemoveForRule
	engine.Workspace().Relations().RemoveForRule(ctx, rule)

	forRule = engine.Workspace().Relations().ForRule(rule)
	assert.Len(t, forRule, 0)
}

func TestEngine_RelationsStore_RemoveForEntity(t *testing.T) {
	ruleID := uuid.New().String()
	r1ID := uuid.New().String()
	r2ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(ruleID),
			integration.RelationshipRuleName("link"),
			integration.RelationshipRuleReference("associated"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleType("associated"),
			integration.RelationshipRuleFromCelSelector("true"),
			integration.RelationshipRuleToCelSelector("true"),
			integration.WithCelMatcher("true"),
		),
		integration.WithResource(
			integration.ResourceID(r1ID),
			integration.ResourceKind("svc"),
		),
		integration.WithResource(
			integration.ResourceID(r2ID),
			integration.ResourceKind("db"),
		),
	)

	ctx := context.Background()

	rule, _ := engine.Workspace().RelationshipRules().Get(ruleID)
	r1, _ := engine.Workspace().Resources().Get(r1ID)
	r2, _ := engine.Workspace().Resources().Get(r2ID)

	rel := &relationships.EntityRelation{
		Rule: rule,
		From: relationships.NewResourceEntity(r1),
		To:   relationships.NewResourceEntity(r2),
	}
	_ = engine.Workspace().Relations().Upsert(ctx, rel)

	assert.NotEmpty(t, engine.Workspace().Relations().Items())

	// Delete resource via event — triggers RemoveForEntity
	engine.PushEvent(ctx, handler.ResourceDelete, r1)

	// The relation should be cleaned up
	entity := relationships.NewResourceEntity(&oapi.Resource{Id: r1ID})
	forEntity := engine.Workspace().Relations().ForEntity(entity)
	assert.Empty(t, forEntity)
}
