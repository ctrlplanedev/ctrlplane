package environmentversionrollout

import (
	"context"
	"math"
	"math/rand"
	"testing"
	"time"

	"gotest.tools/assert"
)

func TestGetLinearOffsetFunction(t *testing.T) {
	ctx := context.Background()
	positionGrowthFactor := rand.Intn(100) + 1
	timeScaleInterval := rand.Intn(100) + 1
	numReleaseTargets := rand.Intn(100) + 1

	offsetFunction, err := GetLinearOffsetFunction(positionGrowthFactor, timeScaleInterval, numReleaseTargets)
	if err != nil {
		t.Fatalf("Error getting offset function: %s", err.Error())
	}

	position := rand.Intn(numReleaseTargets)

	offset := offsetFunction(ctx, position)

	expectedOffset := time.Duration(position) * time.Minute

	assert.Equal(t, offset, expectedOffset)
}

func TestGetLinearOffsetFunction_InvalidParameters(t *testing.T) {
	positionGrowthFactor := 0
	timeScaleInterval := 1
	numReleaseTargets := 1

	_, err := GetLinearOffsetFunction(positionGrowthFactor, timeScaleInterval, numReleaseTargets)
	assert.ErrorContains(t, err, "positionGrowthFactor must be greater than 0")

	positionGrowthFactor = 1
	timeScaleInterval = 0
	numReleaseTargets = 1

	_, err = GetLinearOffsetFunction(positionGrowthFactor, timeScaleInterval, numReleaseTargets)
	assert.ErrorContains(t, err, "timeScaleInterval must be greater than 0")

	positionGrowthFactor = 1
	timeScaleInterval = 1
	numReleaseTargets = 0

	_, err = GetLinearOffsetFunction(positionGrowthFactor, timeScaleInterval, numReleaseTargets)
	assert.ErrorContains(t, err, "numReleaseTargets must be greater than 0")
}

func TestGetExponentialOffsetFunction(t *testing.T) {
	ctx := context.Background()
	positionGrowthFactor := rand.Intn(100) + 1
	timeScaleInterval := rand.Intn(100) + 1
	numReleaseTargets := rand.Intn(100) + 1

	offsetFunction, err := GetExponentialOffsetFunction(positionGrowthFactor, timeScaleInterval, numReleaseTargets)
	if err != nil {
		t.Fatalf("Error getting offset function: %s", err.Error())
	}

	position := rand.Intn(numReleaseTargets)

	offset := offsetFunction(ctx, position)

	expectedOffset := time.Duration(
		float64(timeScaleInterval)*(1-math.Exp(-float64(position)/float64(positionGrowthFactor))),
	) * time.Minute

	assert.Equal(t, offset, expectedOffset)
}

func TestGetExponentialOffsetFunction_InvalidParameters(t *testing.T) {
	positionGrowthFactor := 0
	timeScaleInterval := 1
	numReleaseTargets := 1

	_, err := GetExponentialOffsetFunction(positionGrowthFactor, timeScaleInterval, numReleaseTargets)
	assert.ErrorContains(t, err, "positionGrowthFactor must be greater than 0")

	positionGrowthFactor = 1
	timeScaleInterval = 0
	numReleaseTargets = 1

	_, err = GetExponentialOffsetFunction(positionGrowthFactor, timeScaleInterval, numReleaseTargets)
	assert.ErrorContains(t, err, "timeScaleInterval must be greater than 0")

	positionGrowthFactor = 1
	timeScaleInterval = 1
	numReleaseTargets = 0

	_, err = GetExponentialOffsetFunction(positionGrowthFactor, timeScaleInterval, numReleaseTargets)
	assert.ErrorContains(t, err, "numReleaseTargets must be greater than 0")
}
