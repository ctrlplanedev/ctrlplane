package environmentversionrollout

import (
	"context"
	"errors"
	"math"
	"time"
	modelrules "workspace-engine/pkg/model/policy/rules"
)

type PositionOffsetFunction func(ctx context.Context, position int) time.Duration

// OffsetFunctionGetter is a function that returns a function that calculates the offset in seconds from the rollout start time for a given position.
//   - positionGrowthFactor: The growth factor for the position.
//   - timeScaleInterval: The time interval in minutes between each release target.
//   - numReleaseTargets: The number of release targets.
type OffsetFunctionGetter func(positionGrowthFactor int, timeScaleInterval int, numReleaseTargets int) (PositionOffsetFunction, error)

var RolloutTypeToOffsetFunctionGetter = map[modelrules.RolloutType]OffsetFunctionGetter{
	modelrules.RolloutTypeLinear:      GetLinearOffsetFunction,
	modelrules.RolloutTypeExponential: GetExponentialOffsetFunction,
	// RolloutTypeLinearNormalized:      GetLinearNormalizedOffsetFunction,
	// RolloutTypeExponentialNormalized: GetExponentialNormalizedOffsetFunction,
}

func validateOffsetFunctionParameters(positionGrowthFactor int, timeScaleInterval int, numReleaseTargets int) error {
	if positionGrowthFactor <= 0 {
		return errors.New("positionGrowthFactor must be greater than 0")
	}

	if timeScaleInterval <= 0 {
		return errors.New("timeScaleInterval must be greater than 0")
	}

	if numReleaseTargets <= 0 {
		return errors.New("numReleaseTargets must be greater than 0")
	}

	return nil
}

func GetLinearOffsetFunction(positionGrowthFactor int, timeScaleInterval int, numReleaseTargets int) (PositionOffsetFunction, error) {
	if err := validateOffsetFunctionParameters(positionGrowthFactor, timeScaleInterval, numReleaseTargets); err != nil {
		return nil, err
	}

	return func(ctx context.Context, position int) time.Duration {
		return time.Duration(position) * time.Minute
	}, nil
}

func GetExponentialOffsetFunction(positionGrowthFactor int, timeScaleInterval int, numReleaseTargets int) (PositionOffsetFunction, error) {
	if err := validateOffsetFunctionParameters(positionGrowthFactor, timeScaleInterval, numReleaseTargets); err != nil {
		return nil, err
	}

	return func(ctx context.Context, position int) time.Duration {
		offset := float64(timeScaleInterval) * (1 - math.Exp(-float64(position)/float64(numReleaseTargets)))
		return time.Duration(offset) * time.Minute
	}, nil
}
