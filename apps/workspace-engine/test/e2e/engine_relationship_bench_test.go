package e2e

import (
	"context"
	"fmt"
	"runtime"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

func init() {
	log.SetLevel(log.FatalLevel)
}

// BenchmarkRelationshipIndex_AddRule_Resources benchmarks the AddRule +
// Recompute cycle with varying numbers of resources to reproduce the OOM
// seen in production. Each entity is added as both a selector and entity in the
// v2 index, so N resources produce N² pair evaluations per rule.
//
// Run with:
//
//	go test -bench=BenchmarkRelationshipIndex_AddRule_Resources -benchmem -benchtime=3x -timeout=30m ./test/e2e/
func BenchmarkRelationshipIndex_AddRule_Resources(b *testing.B) {
	sizes := []int{100, 500, 1000, 2000}

	for _, n := range sizes {
		b.Run(fmt.Sprintf("resources=%d", n), func(b *testing.B) {
			ctx := context.Background()
			engine := integration.NewTestWorkspace(nil)
			workspaceID := engine.Workspace().ID

			sysID := uuid.New().String()
			sys := c.NewSystem(workspaceID)
			sys.Id = sysID
			engine.PushEvent(ctx, handler.SystemCreate, sys)

			kinds := []string{"vpc", "kubernetes-cluster", "database", "cache", "service"}
			regions := []string{"us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-south-1"}

			b.Logf("Creating %d resources...", n)
			for i := 0; i < n; i++ {
				resource := c.NewResource(workspaceID)
				resource.Id = uuid.New().String()
				resource.Name = fmt.Sprintf("resource-%d", i)
				resource.Kind = kinds[i%len(kinds)]
				resource.Metadata = map[string]string{
					"region": regions[i%len(regions)],
					"tier":   fmt.Sprintf("tier-%d", i%3),
				}
				engine.PushEvent(ctx, handler.ResourceCreate, resource)
			}

			b.Logf("Resources in store: %d", len(engine.Workspace().Resources().Items()))

			rule := &oapi.RelationshipRule{
				Id:          uuid.New().String(),
				Name:        "same-region",
				Reference:   "peer",
				FromType:    "resource",
				ToType:      "resource",
				WorkspaceId: workspaceID,
			}

			fromSel := &oapi.Selector{}
			_ = fromSel.FromCelSelector(oapi.CelSelector{Cel: "resource.kind == 'vpc'"})
			rule.FromSelector = fromSel

			toSel := &oapi.Selector{}
			_ = toSel.FromCelSelector(oapi.CelSelector{Cel: "resource.kind == 'kubernetes-cluster'"})
			rule.ToSelector = toSel

			_ = rule.Matcher.FromCelMatcher(oapi.CelMatcher{
				Cel: "from.metadata.region == to.metadata.region",
			})

			b.ResetTimer()
			b.ReportAllocs()

			for b.Loop() {
				b.StopTimer()
				// Remove the old rule so each iteration starts clean
				engine.Workspace().Store().RelationshipIndexes.RemoveRule(rule.Id)
				rule.Id = uuid.New().String()

				runtime.GC()
				b.StartTimer()

				engine.Workspace().Store().RelationshipIndexes.AddRule(ctx, rule)
				evals := engine.Workspace().Store().RelationshipIndexes.Recompute(ctx)

				b.StopTimer()
				b.ReportMetric(float64(evals), "evaluations/op")
				b.StartTimer()
			}

			b.StopTimer()
			runtime.GC()
			var m runtime.MemStats
			runtime.ReadMemStats(&m)
			b.ReportMetric(float64(m.Alloc)/(1024*1024*1024), "heap-GB")
			b.ReportMetric(float64(m.TotalAlloc)/(1024*1024*1024), "total-alloc-GB")
		})
	}
}

// BenchmarkRelationshipIndex_Recompute_DirtyAll benchmarks a full recompute of
// the relationship index after all entities are marked dirty. This simulates
// the worst case where something triggers a complete re-evaluation.
//
// Run with:
//
//	go test -bench=BenchmarkRelationshipIndex_Recompute_DirtyAll -benchmem -benchtime=3x -timeout=30m ./test/e2e/
func BenchmarkRelationshipIndex_Recompute_DirtyAll(b *testing.B) {
	sizes := []int{1000}

	for _, n := range sizes {
		b.Run(fmt.Sprintf("resources=%d", n), func(b *testing.B) {
			ctx := context.Background()
			engine := integration.NewTestWorkspace(nil)
			workspaceID := engine.Workspace().ID

			sysID := uuid.New().String()
			sys := c.NewSystem(workspaceID)
			sys.Id = sysID
			engine.PushEvent(ctx, handler.SystemCreate, sys)

			kinds := []string{"vpc", "kubernetes-cluster", "database", "cache", "service"}
			regions := []string{"us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-south-1"}

			for i := 0; i < n; i++ {
				resource := c.NewResource(workspaceID)
				resource.Id = uuid.New().String()
				resource.Name = fmt.Sprintf("resource-%d", i)
				resource.Kind = kinds[i%len(kinds)]
				resource.Metadata = map[string]string{
					"region": regions[i%len(regions)],
					"tier":   fmt.Sprintf("tier-%d", i%3),
				}
				engine.PushEvent(ctx, handler.ResourceCreate, resource)
			}

			rule := &oapi.RelationshipRule{
				Id:          uuid.New().String(),
				Name:        "same-region",
				Reference:   "peer",
				FromType:    "resource",
				ToType:      "resource",
				WorkspaceId: workspaceID,
			}

			fromSel := &oapi.Selector{}
			_ = fromSel.FromCelSelector(oapi.CelSelector{Cel: "resource.kind == 'vpc'"})
			rule.FromSelector = fromSel

			toSel := &oapi.Selector{}
			_ = toSel.FromCelSelector(oapi.CelSelector{Cel: "resource.kind == 'kubernetes-cluster'"})
			rule.ToSelector = toSel

			_ = rule.Matcher.FromCelMatcher(oapi.CelMatcher{
				Cel: "from.metadata.region == to.metadata.region",
			})

			// Initial setup
			engine.Workspace().Store().RelationshipIndexes.AddRule(ctx, rule)
			engine.Workspace().Store().RelationshipIndexes.Recompute(ctx)

			b.ResetTimer()
			b.ReportAllocs()

			var totalEvals int64
			for b.Loop() {
				engine.Workspace().Store().RelationshipIndexes.DirtyAll(ctx)
				totalEvals += int64(engine.Workspace().Store().RelationshipIndexes.Recompute(ctx))
			}

			b.StopTimer()

			b.ReportMetric(float64(b.Elapsed().Nanoseconds())/float64(totalEvals), "ns/eval")

			runtime.GC()
			var m runtime.MemStats
			runtime.ReadMemStats(&m)
			b.ReportMetric(float64(m.Alloc)/(1024*1024*1024), "heap-GB")
		})
	}
}

// BenchmarkRelationshipIndex_MultipleRules benchmarks the scenario where
// multiple relationship rules exist and resources are added. This tests the
// fan-out overhead where each entity addition propagates to every rule index.
//
// Run with:
//
//	go test -bench=BenchmarkRelationshipIndex_MultipleRules -benchmem -benchtime=3x -timeout=30m ./test/e2e/
func BenchmarkRelationshipIndex_MultipleRules(b *testing.B) {
	const numResources = 1000

	ruleCounts := []int{1, 5, 10}

	for _, numRules := range ruleCounts {
		b.Run(fmt.Sprintf("rules=%d_resources=%d", numRules, numResources), func(b *testing.B) {
			ctx := context.Background()
			engine := integration.NewTestWorkspace(nil)
			workspaceID := engine.Workspace().ID

			sysID := uuid.New().String()
			sys := c.NewSystem(workspaceID)
			sys.Id = sysID
			engine.PushEvent(ctx, handler.SystemCreate, sys)

			kinds := []string{"vpc", "kubernetes-cluster", "database", "cache", "service"}
			regions := []string{"us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-south-1"}

			for i := 0; i < numResources; i++ {
				resource := c.NewResource(workspaceID)
				resource.Id = uuid.New().String()
				resource.Name = fmt.Sprintf("resource-%d", i)
				resource.Kind = kinds[i%len(kinds)]
				resource.Metadata = map[string]string{
					"region": regions[i%len(regions)],
					"tier":   fmt.Sprintf("tier-%d", i%3),
				}
				engine.PushEvent(ctx, handler.ResourceCreate, resource)
			}

			matchers := []struct {
				name    string
				fromCel string
				toCel   string
				match   string
			}{
				{"same-region", "resource.kind == 'vpc'", "resource.kind == 'kubernetes-cluster'", "from.metadata.region == to.metadata.region"},
				{"same-tier", "resource.kind == 'database'", "resource.kind == 'service'", "from.metadata.tier == to.metadata.tier"},
				{"vpc-to-db", "resource.kind == 'vpc'", "resource.kind == 'database'", "from.metadata.region == to.metadata.region"},
				{"cluster-to-cache", "resource.kind == 'kubernetes-cluster'", "resource.kind == 'cache'", "from.metadata.region == to.metadata.region"},
				{"service-to-cache", "resource.kind == 'service'", "resource.kind == 'cache'", "from.metadata.tier == to.metadata.tier"},
				{"vpc-to-service", "resource.kind == 'vpc'", "resource.kind == 'service'", "from.metadata.region == to.metadata.region"},
				{"db-to-cache", "resource.kind == 'database'", "resource.kind == 'cache'", "from.metadata.region == to.metadata.region"},
				{"cluster-to-service", "resource.kind == 'kubernetes-cluster'", "resource.kind == 'service'", "from.metadata.region == to.metadata.region"},
				{"cluster-to-db", "resource.kind == 'kubernetes-cluster'", "resource.kind == 'database'", "from.metadata.region == to.metadata.region"},
				{"vpc-to-cache", "resource.kind == 'vpc'", "resource.kind == 'cache'", "from.metadata.region == to.metadata.region"},
			}

			b.ResetTimer()
			b.ReportAllocs()

			for b.Loop() {
				b.StopTimer()
				// Clear all rules
				for i := 0; i < numRules; i++ {
					engine.Workspace().Store().RelationshipIndexes.RemoveRule(fmt.Sprintf("rule-%d", i))
				}
				runtime.GC()
				b.StartTimer()

				for i := 0; i < numRules; i++ {
					m := matchers[i%len(matchers)]

					rule := &oapi.RelationshipRule{
						Id:          fmt.Sprintf("rule-%d", i),
						Name:        m.name,
						Reference:   fmt.Sprintf("ref-%d", i),
						FromType:    "resource",
						ToType:      "resource",
						WorkspaceId: workspaceID,
					}

					fromSel := &oapi.Selector{}
					_ = fromSel.FromCelSelector(oapi.CelSelector{Cel: m.fromCel})
					rule.FromSelector = fromSel

					toSel := &oapi.Selector{}
					_ = toSel.FromCelSelector(oapi.CelSelector{Cel: m.toCel})
					rule.ToSelector = toSel

					_ = rule.Matcher.FromCelMatcher(oapi.CelMatcher{Cel: m.match})

					engine.Workspace().Store().RelationshipIndexes.AddRule(ctx, rule)
				}

				evals := engine.Workspace().Store().RelationshipIndexes.Recompute(ctx)

				b.StopTimer()
				b.ReportMetric(float64(evals), "evaluations/op")
				b.StartTimer()
			}

			b.StopTimer()

			runtime.GC()
			var m runtime.MemStats
			runtime.ReadMemStats(&m)
			b.ReportMetric(float64(m.Alloc)/(1024*1024*1024), "heap-GB")
			b.ReportMetric(float64(m.TotalAlloc)/(1024*1024*1024), "total-alloc-GB")
		})
	}
}
