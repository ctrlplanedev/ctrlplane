package jsonselector

import (
	"context"
	"workspace-engine/pkg/selector/langs/jsonselector/compare"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"

	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("jsonselector")

func ConvertToSelector(ctx context.Context, unknownCondition unknown.UnknownCondition) (unknown.MatchableCondition, error) {
	_, span := tracer.Start(ctx, "ConvertToSelector")
	defer span.End()

	return compare.ConvertToSelector(unknownCondition)
}
