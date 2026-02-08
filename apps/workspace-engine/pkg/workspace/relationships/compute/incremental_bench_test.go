package compute

import (
	"context"
	"fmt"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
)

func BenchmarkFindRemovedRelations(b *testing.B) {
	ctx := context.Background()

	rule := &oapi.RelationshipRule{Id: "rule-1"}
	from := relationships.NewResourceEntity(&oapi.Resource{Id: "resource-1"})

	oldRelations := make([]*relationships.EntityRelation, 0, 20000)
	newRelations := make([]*relationships.EntityRelation, 0, 15000)

	for i := 0; i < 20000; i++ {
		to := relationships.NewDeploymentEntity(&oapi.Deployment{Id: fmt.Sprintf("deployment-%d", i)})
		relation := &relationships.EntityRelation{
			Rule: rule,
			From: from,
			To:   to,
		}
		oldRelations = append(oldRelations, relation)
		if i%4 != 0 {
			newRelations = append(newRelations, relation)
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		removed := FindRemovedRelations(ctx, oldRelations, newRelations)
		if len(removed) == 0 {
			b.Fatal("unexpected empty result")
		}
	}
}
