package oapi

import "encoding/json"

func (e *RelatableEntity) GetType() RelatableEntityType {
	// Try to unmarshal into a map to check for distinguishing fields
	var data map[string]any
	if err := json.Unmarshal(e.union, &data); err != nil {
		return ""
	}

	// Check for distinguishing fields
	// Deployment has "slug" field
	if _, hasSlug := data["slug"]; hasSlug {
		return "deployment"
	}

	// Resource has "kind" field
	if _, hasKind := data["kind"]; hasKind {
		return "resource"
	}

	// Environment has "systemId" but no "slug" or "kind"
	if _, hasSystemId := data["systemId"]; hasSystemId {
		return "environment"
	}

	return ""
}

func (e *RelatableEntity) GetDeployment() *Deployment {
	if e.GetType() == "deployment" {
		deployment, err := e.AsDeployment()
		if err != nil {
			return nil
		}
		return &deployment
	}
	return nil
}

func (e *RelatableEntity) GetEnvironment() *Environment {
	if e.GetType() == "environment" {
		environment, err := e.AsEnvironment()
		if err != nil {
			return nil
		}
		return &environment
	}
	return nil
}

func (e *RelatableEntity) GetResource() *Resource {
	if e.GetType() == "resource" {
		resource, err := e.AsResource()
		if err != nil {
			return nil
		}
		return &resource
	}
	return nil
}

func (e *RelatableEntity) GetID() string {
	switch e.GetType() {
	case "deployment":
		d := e.GetDeployment()
		if d != nil {
			return d.Id
		}
	case "environment":
		env := e.GetEnvironment()
		if env != nil {
			return env.Id
		}
	case "resource":
		r := e.GetResource()
		if r != nil {
			return r.Id
		}
	}
	return ""
}

// Item returns the underlying entity (Resource, Deployment, or Environment) as an interface{}
// This is used when the actual entity type is needed (e.g., for selectors)
func (e *RelatableEntity) Item() any {
	switch e.GetType() {
	case "deployment":
		return e.GetDeployment()
	case "environment":
		return e.GetEnvironment()
	case "resource":
		return e.GetResource()
	}
	return nil
}
