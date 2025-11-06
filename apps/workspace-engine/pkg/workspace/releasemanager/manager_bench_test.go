package releasemanager

import (
	"context"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

// ===== Benchmark Helper Functions =====

func createBenchSystem(workspaceID, id, name string) *oapi.System {
	return &oapi.System{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
	}
}

func createBenchEnvironment(systemID, id, name string) *oapi.Environment {
	now := time.Now().Format(time.RFC3339)
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})

	description := fmt.Sprintf("Benchmark environment %s", name)
	return &oapi.Environment{
		Id:               id,
		Name:             name,
		Description:      &description,
		SystemId:         systemID,
		ResourceSelector: selector,
		CreatedAt:        now,
	}
}

func createBenchDeployment(systemID, id, name string) *oapi.Deployment {
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})

	description := fmt.Sprintf("Benchmark deployment %s", name)
	jobAgentID := uuid.New().String()
	return &oapi.Deployment{
		Id:               id,
		Name:             name,
		Slug:             name,
		SystemId:         systemID,
		Description:      &description,
		ResourceSelector: selector,
		JobAgentId:       &jobAgentID,
		JobAgentConfig:   map[string]any{},
	}
}

func createBenchDeploymentVersion(id, deploymentID, tag string, status oapi.DeploymentVersionStatus) *oapi.DeploymentVersion {
	now := time.Now()
	return &oapi.DeploymentVersion{
		Id:             id,
		DeploymentId:   deploymentID,
		Tag:            tag,
		Name:           fmt.Sprintf("version-%s", tag),
		Status:         status,
		Config:         map[string]any{},
		JobAgentConfig: map[string]any{},
		CreatedAt:      now,
	}
}

func createBenchResource(workspaceID, id, name string) *oapi.Resource {
	now := time.Now()
	return &oapi.Resource{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		Identifier:  name,
		Kind:        "server",
		Version:     "v1",
		CreatedAt:   now,
		Config:      map[string]any{},
		Metadata: map[string]string{
			"region": "us-west-1",
			"tier":   "production",
		},
	}
}

func createBenchPolicy(id, workspaceID, name string) *oapi.Policy {
	now := time.Now().Format(time.RFC3339)
	return &oapi.Policy{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		CreatedAt:   now,
		Rules:       []oapi.PolicyRule{},
		Selectors:   []oapi.PolicyTargetSelector{},
	}
}

func createBenchReleaseTarget(envID, depID, resID string) *oapi.ReleaseTarget {
	return &oapi.ReleaseTarget{
		EnvironmentId: envID,
		DeploymentId:  depID,
		ResourceId:    resID,
	}
}

// setupBenchmarkManager creates a manager with the specified number of entities and policies
func setupBenchmarkManager(
	b *testing.B,
	numReleaseTargets int,
	numPolicies int,
) (*Manager, []*oapi.ReleaseTarget, *statechange.ChangeSet[any]) {
	b.Helper()
	ctx := context.Background()
	workspaceID := "bench-workspace-" + uuid.New().String()
	cs := statechange.NewChangeSet[any]()
	st := store.New(workspaceID, cs)

	// Create system
	systemID := uuid.New().String()
	sys := createBenchSystem(workspaceID, systemID, "bench-system")
	if err := st.Systems.Upsert(ctx, sys); err != nil {
		b.Fatalf("Failed to create system: %v", err)
	}

	// Calculate distribution of entities to reach target release targets
	// Formula: targets = resources * environments * deployments
	// For 500 targets, use: 10 resources × 10 environments × 5 deployments
	numResources := 10
	numEnvironments := 10
	numDeployments := 5

	// Adjust if needed to hit target
	targetPerCombination := numReleaseTargets / (numResources * numEnvironments * numDeployments)
	if targetPerCombination == 0 {
		targetPerCombination = 1
	}

	// Create resources with variety of types for relationships
	resourceIDs := make([]string, numResources)
	databaseIDs := make([]string, 0)
	vpcIDs := make([]string, 0)

	for i := 0; i < numResources; i++ {
		resourceID := uuid.New().String()
		resourceIDs[i] = resourceID
		resourceName := fmt.Sprintf("resource-%d", i)
		res := createBenchResource(workspaceID, resourceID, resourceName)

		// Distribute resources across different kinds
		kindIndex := i % 5
		switch kindIndex {
		case 0:
			// Database resources
			res.Kind = "database"
			res.Metadata["host"] = fmt.Sprintf("db-%d.example.com", i)
			res.Metadata["port"] = "5432"
			databaseIDs = append(databaseIDs, resourceID)
		case 1:
			// VPC resources
			res.Kind = "vpc"
			res.Metadata["cidr"] = fmt.Sprintf("10.%d.0.0/16", i%256)
			vpcIDs = append(vpcIDs, resourceID)
		default:
			// Service resources (will reference databases and VPCs)
			res.Kind = "service"
			// Create relationships by storing IDs in metadata
			if len(databaseIDs) > 0 {
				res.Metadata["db_id"] = databaseIDs[i%len(databaseIDs)]
			}
			if len(vpcIDs) > 0 {
				res.Metadata["vpc_id"] = vpcIDs[i%len(vpcIDs)]
			}
		}

		// Add variety to metadata for realistic policy matching
		res.Metadata["tier"] = []string{"frontend", "backend", "infrastructure"}[i%3]
		res.Metadata["region"] = []string{"us-east-1", "us-west-2", "eu-west-1"}[i%3]
		res.Metadata["criticality"] = []string{"high", "medium", "low"}[i%3]

		if _, err := st.Resources.Upsert(ctx, res); err != nil {
			b.Fatalf("Failed to create resource: %v", err)
		}
	}

	// Create environments
	environmentIDs := make([]string, numEnvironments)
	environmentNames := make([]string, numEnvironments)
	for i := range numEnvironments {
		environmentID := uuid.New().String()
		environmentIDs[i] = environmentID
		envName := []string{"dev", "staging", "qa", "pre-prod", "prod", "prod-us", "prod-eu", "prod-asia", "canary", "beta"}[i%10]
		environmentNames[i] = envName
		env := createBenchEnvironment(systemID, environmentID, envName)

		if err := st.Environments.Upsert(ctx, env); err != nil {
			b.Fatalf("Failed to create environment: %v", err)
		}
	}

	// Create deployments with versions and variables
	deploymentIDs := make([]string, numDeployments)
	for i := range numDeployments {
		deploymentID := uuid.New().String()
		deploymentIDs[i] = deploymentID
		deploymentName := fmt.Sprintf("deployment-%d", i)
		dep := createBenchDeployment(systemID, deploymentID, deploymentName)

		if err := st.Deployments.Upsert(ctx, dep); err != nil {
			b.Fatalf("Failed to create deployment: %v", err)
		}

		// Create deployment variables with relationship references
		// Variable 1: db_host (reference to database resource)
		dbHostVarID := uuid.New().String()
		dbHostVar := &oapi.DeploymentVariable{
			Id:           dbHostVarID,
			Key:          "db_host",
			DeploymentId: deploymentID,
		}
		st.DeploymentVariables.Upsert(ctx, dbHostVarID, dbHostVar)

		// Create deployment variable value with reference
		dbHostValueID := uuid.New().String()
		refValue := &oapi.ReferenceValue{
			Reference: "database",
			Path:      []string{"metadata", "host"},
		}
		value := &oapi.Value{}
		_ = value.FromReferenceValue(*refValue)

		dbHostValue := &oapi.DeploymentVariableValue{
			Id:                   dbHostValueID,
			DeploymentVariableId: dbHostVarID,
			Priority:             1,
			Value:                *value,
		}
		st.DeploymentVariableValues.Upsert(ctx, dbHostValueID, dbHostValue)

		// Variable 2: vpc_id (reference to VPC resource)
		vpcIDVarID := uuid.New().String()
		vpcIDVar := &oapi.DeploymentVariable{
			Id:           vpcIDVarID,
			Key:          "vpc_id",
			DeploymentId: deploymentID,
		}
		st.DeploymentVariables.Upsert(ctx, vpcIDVarID, vpcIDVar)

		vpcIDValueID := uuid.New().String()
		vpcRefValue := &oapi.ReferenceValue{
			Reference: "vpc",
			Path:      []string{"id"},
		}
		vpcValue := &oapi.Value{}
		_ = vpcValue.FromReferenceValue(*vpcRefValue)

		vpcIDValue := &oapi.DeploymentVariableValue{
			Id:                   vpcIDValueID,
			DeploymentVariableId: vpcIDVarID,
			Priority:             1,
			Value:                *vpcValue,
		}
		st.DeploymentVariableValues.Upsert(ctx, vpcIDValueID, vpcIDValue)

		// Variable 3: replicas (literal value for comparison)
		replicasVarID := uuid.New().String()
		defaultReplicas := &oapi.LiteralValue{}
		_ = defaultReplicas.FromIntegerValue(3)

		replicasVar := &oapi.DeploymentVariable{
			Id:           replicasVarID,
			Key:          "replicas",
			DeploymentId: deploymentID,
			DefaultValue: defaultReplicas,
		}
		st.DeploymentVariables.Upsert(ctx, replicasVarID, replicasVar)

		// Create at least one ready version for each deployment
		versionID := uuid.New().String()
		version := createBenchDeploymentVersion(versionID, deploymentID, "v1.0.0", oapi.DeploymentVersionStatusReady)
		st.DeploymentVersions.Upsert(ctx, versionID, version)
	}

	// Create policies with various rule types
	for i := 0; i < numPolicies; i++ {
		policyID := uuid.New().String()
		policyName := fmt.Sprintf("policy-%d", i)
		pol := createBenchPolicy(policyID, workspaceID, policyName)

		ruleID := uuid.New().String()
		createdAt := time.Now().Format(time.RFC3339)

		// Distribute different policy types
		switch i % 5 {
		case 0:
			// Approval policy
			pol.Rules = append(pol.Rules, oapi.PolicyRule{
				Id:        ruleID,
				PolicyId:  policyID,
				CreatedAt: createdAt,
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			})

		case 1:
			// Environment progression (if we have enough environments)
			if len(environmentIDs) >= 2 {
				dependsOnSelector := &oapi.Selector{}
				_ = dependsOnSelector.FromCelSelector(oapi.CelSelector{
					Cel: fmt.Sprintf("environment.id == '%s'", environmentIDs[0]),
				})

				pol.Rules = append(pol.Rules, oapi.PolicyRule{
					Id:        ruleID,
					PolicyId:  policyID,
					CreatedAt: createdAt,
					EnvironmentProgression: &oapi.EnvironmentProgressionRule{
						DependsOnEnvironmentSelector: *dependsOnSelector,
					},
				})
			}

		case 2:
			// Gradual rollout
			pol.Rules = append(pol.Rules, oapi.PolicyRule{
				Id:        ruleID,
				PolicyId:  policyID,
				CreatedAt: createdAt,
				GradualRollout: &oapi.GradualRolloutRule{
					TimeScaleInterval: 60,
				},
			})

		case 3:
			// Another gradual rollout with different interval
			pol.Rules = append(pol.Rules, oapi.PolicyRule{
				Id:        ruleID,
				PolicyId:  policyID,
				CreatedAt: createdAt,
				GradualRollout: &oapi.GradualRolloutRule{
					TimeScaleInterval: 120,
				},
			})

		case 4:
			// Combined: approval + environment progression
			pol.Rules = append(pol.Rules, oapi.PolicyRule{
				Id:        ruleID,
				PolicyId:  policyID,
				CreatedAt: createdAt,
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 1,
				},
			})

			if len(environmentIDs) >= 3 {
				ruleID2 := uuid.New().String()
				dependsOnSelector := &oapi.Selector{}
				_ = dependsOnSelector.FromCelSelector(oapi.CelSelector{
					Cel: fmt.Sprintf("environment.id == '%s'", environmentIDs[1]),
				})

				pol.Rules = append(pol.Rules, oapi.PolicyRule{
					Id:        ruleID2,
					PolicyId:  policyID,
					CreatedAt: createdAt,
					EnvironmentProgression: &oapi.EnvironmentProgressionRule{
						DependsOnEnvironmentSelector: *dependsOnSelector,
					},
				})
			}
		}

		// Target policies to specific environments and deployments
		// Target production-like environments with more stringent policies
		if i%2 == 0 && len(environmentNames) > 4 {
			envSelector := &oapi.Selector{}
			_ = envSelector.FromCelSelector(oapi.CelSelector{
				Cel: "environment.name in ['prod', 'prod-us', 'prod-eu', 'prod-asia']",
			})
			pol.Selectors = append(pol.Selectors, oapi.PolicyTargetSelector{
				EnvironmentSelector: envSelector,
			})
		}

		// Target specific deployments
		if i < len(deploymentIDs) {
			deploymentSelector := &oapi.Selector{}
			_ = deploymentSelector.FromJsonSelector(oapi.JsonSelector{
				Json: map[string]any{
					"type":     "id",
					"operator": "equals",
					"value":    deploymentIDs[i%len(deploymentIDs)],
				},
			})
			pol.Selectors = append(pol.Selectors, oapi.PolicyTargetSelector{
				DeploymentSelector: deploymentSelector,
			})
		}

		st.Policies.Upsert(ctx, pol)
	}

	// Create relationship rules for variable resolution
	// Rule 1: Service to Database relationship
	dbRelRuleID := uuid.New().String()
	dbFromSelector := &oapi.Selector{}
	_ = dbFromSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "service",
		},
	})
	dbToSelector := &oapi.Selector{}
	_ = dbToSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "database",
		},
	})

	dbMatcher := oapi.RelationshipRule_Matcher{}
	_ = dbMatcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"metadata", "db_id"},
				ToProperty:   []string{"id"},
				Operator:     oapi.Equals,
			},
		},
	})

	dbRelRule := &oapi.RelationshipRule{
		Id:               dbRelRuleID,
		WorkspaceId:      workspaceID,
		Name:             "service-to-database",
		Reference:        "database",
		FromType:         "resource",
		ToType:           "resource",
		RelationshipType: "depends-on",
		FromSelector:     dbFromSelector,
		ToSelector:       dbToSelector,
		Matcher:          dbMatcher,
		Metadata:         map[string]string{},
	}
	st.Relationships.Upsert(ctx, dbRelRule)

	// Rule 2: Service to VPC relationship
	vpcRelRuleID := uuid.New().String()
	vpcFromSelector := &oapi.Selector{}
	_ = vpcFromSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "service",
		},
	})
	vpcToSelector := &oapi.Selector{}
	_ = vpcToSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "vpc",
		},
	})

	vpcMatcher := oapi.RelationshipRule_Matcher{}
	_ = vpcMatcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"metadata", "vpc_id"},
				ToProperty:   []string{"id"},
				Operator:     oapi.Equals,
			},
		},
	})

	vpcRelRule := &oapi.RelationshipRule{
		Id:               vpcRelRuleID,
		WorkspaceId:      workspaceID,
		Name:             "service-to-vpc",
		Reference:        "vpc",
		FromType:         "resource",
		ToType:           "resource",
		RelationshipType: "depends-on",
		FromSelector:     vpcFromSelector,
		ToSelector:       vpcToSelector,
		Matcher:          vpcMatcher,
		Metadata:         map[string]string{},
	}
	st.Relationships.Upsert(ctx, vpcRelRule)

	// Create release targets
	releaseTargets := make([]*oapi.ReleaseTarget, 0, numReleaseTargets)
	for i := 0; i < numResources && len(releaseTargets) < numReleaseTargets; i++ {
		for j := 0; j < numEnvironments && len(releaseTargets) < numReleaseTargets; j++ {
			for k := 0; k < numDeployments && len(releaseTargets) < numReleaseTargets; k++ {
				rt := createBenchReleaseTarget(
					environmentIDs[j],
					deploymentIDs[k],
					resourceIDs[i],
				)
				releaseTargets = append(releaseTargets, rt)

				// Upsert into store so they exist for reconciliation
				if err := st.ReleaseTargets.Upsert(ctx, rt); err != nil {
					b.Fatalf("Failed to create release target: %v", err)
				}
			}
		}
	}

	// Create the manager
	manager := New(st)

	b.Logf("Created %d release targets, %d policies, %d resources, %d environments, %d deployments",
		len(releaseTargets), numPolicies, numResources, numEnvironments, numDeployments)

	return manager, releaseTargets, cs
}

// ===== Benchmarks =====

// BenchmarkProcessChanges_500Targets_NoPolicies benchmarks with 500 targets and no policies
func BenchmarkProcessChanges_500Targets_NoPolicies(b *testing.B) {
	manager, releaseTargets, _ := setupBenchmarkManager(b, 500, 0)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		// Create a fresh changeset for each iteration
		changes := statechange.NewChangeSet[any]()
		for _, rt := range releaseTargets {
			changes.RecordUpsert(rt)
		}

		err := manager.ProcessChanges(ctx, changes)
		if err != nil {
			b.Fatalf("ProcessChanges failed: %v", err)
		}
	}
}

// BenchmarkProcessChanges_500Targets_10Policies benchmarks with 500 targets and 10 policies
func BenchmarkProcessChanges_500Targets_10Policies(b *testing.B) {
	manager, releaseTargets, _ := setupBenchmarkManager(b, 500, 10)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		// Create a fresh changeset for each iteration
		changes := statechange.NewChangeSet[any]()
		for _, rt := range releaseTargets {
			changes.RecordUpsert(rt)
		}

		err := manager.ProcessChanges(ctx, changes)
		if err != nil {
			b.Fatalf("ProcessChanges failed: %v", err)
		}
	}
}

// BenchmarkProcessChanges_500Targets_25Policies benchmarks with 500 targets and 25 policies
func BenchmarkProcessChanges_500Targets_25Policies(b *testing.B) {
	manager, releaseTargets, _ := setupBenchmarkManager(b, 500, 25)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		// Create a fresh changeset for each iteration
		changes := statechange.NewChangeSet[any]()
		for _, rt := range releaseTargets {
			changes.RecordUpsert(rt)
		}

		err := manager.ProcessChanges(ctx, changes)
		if err != nil {
			b.Fatalf("ProcessChanges failed: %v", err)
		}
	}
}

// BenchmarkProcessChanges_500Targets_50Policies benchmarks with 500 targets and 50 policies
func BenchmarkProcessChanges_500Targets_50Policies(b *testing.B) {
	manager, releaseTargets, _ := setupBenchmarkManager(b, 500, 50)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		// Create a fresh changeset for each iteration
		changes := statechange.NewChangeSet[any]()
		for _, rt := range releaseTargets {
			changes.RecordUpsert(rt)
		}

		err := manager.ProcessChanges(ctx, changes)
		if err != nil {
			b.Fatalf("ProcessChanges failed: %v", err)
		}
	}
}

// BenchmarkProcessChanges_500Targets_100Policies benchmarks with 500 targets and 100 policies
func BenchmarkProcessChanges_500Targets_100Policies(b *testing.B) {
	manager, releaseTargets, _ := setupBenchmarkManager(b, 500, 100)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		// Create a fresh changeset for each iteration
		changes := statechange.NewChangeSet[any]()
		for _, rt := range releaseTargets {
			changes.RecordUpsert(rt)
		}

		err := manager.ProcessChanges(ctx, changes)
		if err != nil {
			b.Fatalf("ProcessChanges failed: %v", err)
		}
	}
}

// BenchmarkProcessChanges_MixedOperations benchmarks with mixed upserts and deletes
func BenchmarkProcessChanges_MixedOperations(b *testing.B) {
	manager, releaseTargets, _ := setupBenchmarkManager(b, 500, 25)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		// Create a changeset with mixed operations
		changes := statechange.NewChangeSet[any]()

		// Upsert 80% of targets
		for idx, rt := range releaseTargets {
			if idx%5 != 0 {
				changes.RecordUpsert(rt)
			}
		}

		// Delete 20% of targets
		for idx, rt := range releaseTargets {
			if idx%5 == 0 {
				changes.RecordDelete(rt)
			}
		}

		err := manager.ProcessChanges(ctx, changes)
		if err != nil {
			b.Fatalf("ProcessChanges failed: %v", err)
		}
	}
}

// BenchmarkProcessChanges_DeduplicationStress tests the deduplication logic
func BenchmarkProcessChanges_DeduplicationStress(b *testing.B) {
	manager, releaseTargets, _ := setupBenchmarkManager(b, 500, 10)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		// Create a changeset with many duplicates and conflicting operations
		changes := statechange.NewChangeSet[any]()

		// For each target, add multiple upserts and some deletes
		for _, rt := range releaseTargets {
			// Add 3 upserts
			changes.RecordUpsert(rt)
			changes.RecordUpsert(rt)
			changes.RecordUpsert(rt)

			// Every 10th target gets deleted at the end (should win)
			if len(releaseTargets)%10 == 0 {
				changes.RecordDelete(rt)
			}
		}

		err := manager.ProcessChanges(ctx, changes)
		if err != nil {
			b.Fatalf("ProcessChanges failed: %v", err)
		}
	}
}

// BenchmarkProcessChanges_SmallBatch benchmarks with a small batch of 50 targets
func BenchmarkProcessChanges_SmallBatch(b *testing.B) {
	manager, releaseTargets, _ := setupBenchmarkManager(b, 50, 10)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		changes := statechange.NewChangeSet[any]()
		for _, rt := range releaseTargets {
			changes.RecordUpsert(rt)
		}

		err := manager.ProcessChanges(ctx, changes)
		if err != nil {
			b.Fatalf("ProcessChanges failed: %v", err)
		}
	}
}

// BenchmarkProcessChanges_LargeBatch benchmarks with a large batch of 1000 targets
func BenchmarkProcessChanges_LargeBatch(b *testing.B) {
	manager, releaseTargets, _ := setupBenchmarkManager(b, 1000, 25)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		changes := statechange.NewChangeSet[any]()
		for _, rt := range releaseTargets {
			changes.RecordUpsert(rt)
		}

		err := manager.ProcessChanges(ctx, changes)
		if err != nil {
			b.Fatalf("ProcessChanges failed: %v", err)
		}
	}
}

// BenchmarkProcessChanges_VaryingPolicies benchmarks with different policy counts
func BenchmarkProcessChanges_VaryingPolicies(b *testing.B) {
	policyCounts := []int{0, 5, 10, 25, 50, 100}

	for _, policyCount := range policyCounts {
		b.Run(fmt.Sprintf("Policies_%d", policyCount), func(b *testing.B) {
			manager, releaseTargets, _ := setupBenchmarkManager(b, 500, policyCount)
			ctx := context.Background()

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				changes := statechange.NewChangeSet[any]()
				for _, rt := range releaseTargets {
					changes.RecordUpsert(rt)
				}

				err := manager.ProcessChanges(ctx, changes)
				if err != nil {
					b.Fatalf("ProcessChanges failed: %v", err)
				}
			}
		})
	}
}

// BenchmarkProcessChanges_OnlyDeletes benchmarks pure deletion operations
func BenchmarkProcessChanges_OnlyDeletes(b *testing.B) {
	manager, releaseTargets, _ := setupBenchmarkManager(b, 500, 25)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		changes := statechange.NewChangeSet[any]()
		for _, rt := range releaseTargets {
			changes.RecordDelete(rt)
		}

		err := manager.ProcessChanges(ctx, changes)
		if err != nil {
			b.Fatalf("ProcessChanges failed: %v", err)
		}
	}
}

