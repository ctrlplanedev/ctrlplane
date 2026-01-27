package oapi

func (w *Workflow) Map() map[string]interface{} {
	return structToMap(w)
}
