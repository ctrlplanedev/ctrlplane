package util

type MatchableCondition interface {
	Matches(entity any) (bool, error)
}