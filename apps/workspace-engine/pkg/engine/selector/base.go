package selector

type BaseEntity[E MatchableEntity] struct {
	ID string
}

func (b BaseEntity[E]) GetID() string {
	return b.ID
}

type BaseSelector[E MatchableEntity] struct {
	ID         string
}

func (b BaseSelector[E]) GetID() string {
	return b.ID
}