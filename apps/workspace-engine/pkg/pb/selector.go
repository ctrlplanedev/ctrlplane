package pb

import "google.golang.org/protobuf/types/known/structpb"

func NewJsonSelector(selector *structpb.Struct) *Selector {
	return &Selector{
		Value: &Selector_Json{
			Json: selector,
		},
	}
}