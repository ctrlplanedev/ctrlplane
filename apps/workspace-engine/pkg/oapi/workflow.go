package oapi

func (w *WorkflowRun) Map() map[string]any {
	return structToMap(w)
}
