package rules

type RolloutType string

const (
	RolloutTypeLinear      RolloutType = "linear"
	RolloutTypeExponential RolloutType = "exponential"
)

type EnvironmentVersionRolloutRule struct {
	ID                   string
	Type                 RolloutType
	PositionGrowthFactor int
	TimeScaleInterval    int
}
