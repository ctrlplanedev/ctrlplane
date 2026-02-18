package oapi

func (w *WorkflowRun) Map() map[string]interface{} {
	return structToMap(w)
}
