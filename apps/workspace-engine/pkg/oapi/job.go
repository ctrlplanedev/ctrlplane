package oapi

import (
	"encoding/json"
	"fmt"
)

// String converts a LiteralValue to its string representation,
// handling strings, numbers, booleans, and other JSON types.
func (lv LiteralValue) String() string {
	var value any
	if err := json.Unmarshal(lv.union, &value); err != nil {
		return ""
	}
	return toString(value)
}

type TemplatableRelease struct {
	Release
	Variables map[string]string `json:"variables"`
}

func (r *Release) ToTemplatable() (*TemplatableRelease, error) {
	variables := make(map[string]string)
	for key, literalValue := range r.Variables {
		variables[key] = literalValue.String()
	}

	return &TemplatableRelease{
		Release:   *r,
		Variables: variables,
	}, nil
}

// TemplatableJobData is a struct that mirrors TemplatableJob but with explicit
// JSON tags to ensure consistent lowercase field names when marshaling to a map.
type TemplatableJobData struct {
	Job         Job                 `json:"job"`
	Release     *TemplatableRelease `json:"release"`
	Resource    *Resource           `json:"resource"`
	Environment *Environment        `json:"environment"`
	Deployment  *Deployment         `json:"deployment"`
}

type TemplatableJob struct {
	JobWithRelease
	Release *TemplatableRelease

	mapCache map[string]any
}

func (j *JobWithRelease) ToTemplatable() (*TemplatableJob,
	error) {
	release, err := j.Release.ToTemplatable()
	if err != nil {
		return nil, fmt.Errorf("failed to get templatable release: %w", err)
	}
	return &TemplatableJob{
		JobWithRelease: *j,
		Release:        release,
	}, nil
}

// Map converts the TemplatableJob to a map[string]any using JSON marshaling.
// This ensures consistent lowercase field names as defined by JSON tags,
// making it suitable for use in Go templates with lowercase variable access
// (e.g., {{.resource.name}} instead of {{.Resource.Name}}).
func (t *TemplatableJob) Map() map[string]any {
	if t.mapCache != nil {
		return t.mapCache
	}

	// Create a struct with explicit JSON tags for consistent serialization
	data := TemplatableJobData{
		Job:         t.Job,
		Release:     t.Release,
		Resource:    t.Resource,
		Environment: t.Environment,
		Deployment:  t.Deployment,
	}

	jsonBytes, err := json.Marshal(data)
	if err != nil {
		// Return empty map on error
		return make(map[string]any)
	}

	var result map[string]any
	if err := json.Unmarshal(jsonBytes, &result); err != nil {
		// Return empty map on error
		return make(map[string]any)
	}

	t.mapCache = result
	return t.mapCache
}
