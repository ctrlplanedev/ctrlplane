package rules

type RolloutType string

const (
	RolloutTypeLinear                RolloutType = "linear"
	RolloutTypeExponential           RolloutType = "exponential"
	RolloutTypeLinearNormalized      RolloutType = "linear-normalized"
	RolloutTypeExponentialNormalized RolloutType = "exponential-normalized"
)

type EnvironmentVersionRolloutRule struct {
	ID                   string
	Type                 RolloutType
	PositionGrowthFactor int
	TimeScaleInterval    int
}
