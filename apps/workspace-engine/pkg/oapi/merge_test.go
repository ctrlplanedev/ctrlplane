package oapi

import (
	"testing"
)

func TestDeepMergeConfigs_Flat(t *testing.T) {
	base := JobAgentConfig{"a": 1, "b": 2}
	override := JobAgentConfig{"b": 3, "c": 4}

	got := DeepMergeConfigs(base, override)

	if got["a"] != 1 {
		t.Errorf("expected a=1, got %v", got["a"])
	}
	if got["b"] != 3 {
		t.Errorf("expected b=3 (overridden), got %v", got["b"])
	}
	if got["c"] != 4 {
		t.Errorf("expected c=4, got %v", got["c"])
	}
}

func TestDeepMergeConfigs_Nested(t *testing.T) {
	base := JobAgentConfig{
		"top": "base",
		"nested": map[string]any{
			"keep": "yes",
			"over": "old",
		},
	}
	override := JobAgentConfig{
		"nested": map[string]any{
			"over": "new",
			"add":  "extra",
		},
	}

	got := DeepMergeConfigs(base, override)

	if got["top"] != "base" {
		t.Errorf("expected top=base, got %v", got["top"])
	}
	nested := got["nested"].(map[string]any)
	if nested["keep"] != "yes" {
		t.Errorf("expected nested.keep=yes, got %v", nested["keep"])
	}
	if nested["over"] != "new" {
		t.Errorf("expected nested.over=new, got %v", nested["over"])
	}
	if nested["add"] != "extra" {
		t.Errorf("expected nested.add=extra, got %v", nested["add"])
	}
}

func TestDeepMergeConfigs_DoesNotMutateInputs(t *testing.T) {
	base := JobAgentConfig{"a": 1, "b": 2}
	override := JobAgentConfig{"b": 3}

	_ = DeepMergeConfigs(base, override)

	if base["b"] != 2 {
		t.Errorf("base was mutated: expected b=2, got %v", base["b"])
	}
}

func TestDeepMergeConfigs_Empty(t *testing.T) {
	got := DeepMergeConfigs()
	if len(got) != 0 {
		t.Errorf("expected empty config, got %v", got)
	}
}

func TestDeepMergeConfigs_Three(t *testing.T) {
	a := JobAgentConfig{"x": 1}
	b := JobAgentConfig{"x": 2, "y": 10}
	c := JobAgentConfig{"y": 20, "z": 30}

	got := DeepMergeConfigs(a, b, c)

	if got["x"] != 2 {
		t.Errorf("expected x=2, got %v", got["x"])
	}
	if got["y"] != 20 {
		t.Errorf("expected y=20, got %v", got["y"])
	}
	if got["z"] != 30 {
		t.Errorf("expected z=30, got %v", got["z"])
	}
}
