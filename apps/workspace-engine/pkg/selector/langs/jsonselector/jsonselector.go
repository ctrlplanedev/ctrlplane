package jsonselector

import (
	"context"

	"go.opentelemetry.io/otel"
	"workspace-engine/pkg/selector/langs/jsonselector/compare"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
	"workspace-engine/pkg/selector/langs/util"
)

var tracer = otel.Tracer("jsonselector")

func ConvertToSelector(
	ctx context.Context,
	unknownCondition unknown.UnknownCondition,
) (util.MatchableCondition, error) {
	_, span := tracer.Start(ctx, "ConvertToSelector")
	defer span.End()

	return compare.ConvertToSelector(unknownCondition)
}
