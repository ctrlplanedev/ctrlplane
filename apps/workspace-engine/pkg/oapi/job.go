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

// TemplatableJobData is the data structure used for Go templating.
// It provides a consistent lowercase field naming convention for templates.
// Fields use JSON tags to ensure consistent key naming when converted to map.
type TemplatableJobData struct {
	Job         Job                 `json:"job"`
	Release     *TemplatableRelease `json:"release"`
	Resource    *Resource           `json:"resource"`
	Environment *Environment        `json:"environment"`
	Deployment  *Deployment         `json:"deployment"`

	mapCache map[string]any `json:"-"`
}

// Map converts the TemplatableJobData to a map[string]any using JSON marshaling.
// This ensures consistent lowercase/camelCase key names matching JSON tags.
// The result is cached for performance.
func (t *TemplatableJobData) Map() map[string]any {
	if t.mapCache != nil {
		return t.mapCache
	}
	data, _ := json.Marshal(t)
	var result map[string]any
	_ = json.Unmarshal(data, &result)
	t.mapCache = result
	return t.mapCache
}

type TemplatableJob struct {
	JobWithRelease
	Release *TemplatableRelease
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

// ToTemplateData converts TemplatableJob to TemplatableJobData for use in templates.
// The returned map uses lowercase/camelCase keys matching the JSON tags,
// providing consistent template variable naming (e.g., {{.resource.name}} instead of {{.Resource.Name}}).
func (t *TemplatableJob) ToTemplateData() map[string]any {
	data := &TemplatableJobData{
		Job:         t.Job,
		Release:     t.Release,
		Resource:    t.Resource,
		Environment: t.Environment,
		Deployment:  t.Deployment,
	}
	return data.Map()
}
