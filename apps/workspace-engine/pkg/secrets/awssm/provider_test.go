package awssm

import (
	"context"
	"errors"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	"workspace-engine/pkg/secrets"
)

type fakeClient struct {
	in  *secretsmanager.GetSecretValueInput
	out *secretsmanager.GetSecretValueOutput
	err error
}

func (f *fakeClient) GetSecretValue(
	_ context.Context,
	in *secretsmanager.GetSecretValueInput,
	_ ...func(*secretsmanager.Options),
) (*secretsmanager.GetSecretValueOutput, error) {
	f.in = in
	if f.err != nil {
		return nil, f.err
	}
	return f.out, nil
}

func TestResolveReturnsRawSecretStringWhenKeyEmpty(t *testing.T) {
	fc := &fakeClient{
		out: &secretsmanager.GetSecretValueOutput{
			SecretString: aws.String("raw-value"),
		},
	}
	p := &Provider{client: fc}

	got, err := p.Resolve(context.Background(), secrets.SecretReference{Path: "prod/db"})
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if got != "raw-value" {
		t.Fatalf("got %q want raw-value", got)
	}
	if fc.in.SecretId == nil || *fc.in.SecretId != "prod/db" {
		t.Fatalf("unexpected SecretId %v", fc.in.SecretId)
	}
}

func TestResolveExtractsJSONFieldByKey(t *testing.T) {
	fc := &fakeClient{
		out: &secretsmanager.GetSecretValueOutput{
			SecretString: aws.String(`{"username":"app","password":"hunter2","nested":{"k":"v"}}`),
		},
	}
	p := &Provider{client: fc}

	got, err := p.Resolve(context.Background(), secrets.SecretReference{
		Path: "prod/db",
		Key:  "password",
	})
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if got != "hunter2" {
		t.Fatalf("got %q want hunter2", got)
	}

	got, err = p.Resolve(context.Background(), secrets.SecretReference{
		Path: "prod/db",
		Key:  "nested.k",
	})
	if err != nil {
		t.Fatalf("Resolve nested: %v", err)
	}
	if got != "v" {
		t.Fatalf("nested got %q want v", got)
	}
}

func TestResolveMissingJSONField(t *testing.T) {
	fc := &fakeClient{
		out: &secretsmanager.GetSecretValueOutput{
			SecretString: aws.String(`{"username":"app"}`),
		},
	}
	p := &Provider{client: fc}

	_, err := p.Resolve(context.Background(), secrets.SecretReference{
		Path: "prod/db",
		Key:  "password",
	})
	if err == nil {
		t.Fatal("expected error for missing JSON field")
	}
}

func TestResolveEmptyPathRejected(t *testing.T) {
	p := &Provider{client: &fakeClient{}}
	_, err := p.Resolve(context.Background(), secrets.SecretReference{Key: "K"})
	if err == nil {
		t.Fatal("expected error for empty Path")
	}
}

func TestResolveNoSecretStringPayload(t *testing.T) {
	fc := &fakeClient{out: &secretsmanager.GetSecretValueOutput{}}
	p := &Provider{client: fc}
	_, err := p.Resolve(context.Background(), secrets.SecretReference{Path: "prod/db"})
	if err == nil {
		t.Fatal("expected error when SecretString is nil")
	}
}

func TestResolveUpstreamErrorPropagates(t *testing.T) {
	fc := &fakeClient{err: errors.New("AccessDenied")}
	p := &Provider{client: fc}
	_, err := p.Resolve(context.Background(), secrets.SecretReference{Path: "prod/db"})
	if err == nil {
		t.Fatal("expected error to propagate")
	}
}

func TestFactoryRejectsBadConfigs(t *testing.T) {
	cases := []struct {
		name string
		cfg  map[string]any
	}{
		{"missing region", map[string]any{}},
		{"empty region", map[string]any{"region": ""}},
		{"region wrong type", map[string]any{"region": 1}},
		{
			"partial creds (key only)",
			map[string]any{"region": "us-east-1", "accessKeyId": "AKIA..."},
		},
		{
			"partial creds (secret only)",
			map[string]any{"region": "us-east-1", "secretAccessKey": "secret"},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := Factory(c.cfg); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}

func TestFactoryAcceptsRegionOnly(t *testing.T) {
	if _, err := Factory(map[string]any{"region": "us-east-1"}); err != nil {
		t.Fatalf("Factory: %v", err)
	}
}

func TestFactoryAcceptsStaticCreds(t *testing.T) {
	if _, err := Factory(map[string]any{
		"region":          "us-east-1",
		"accessKeyId":     "AKIAIOSFODNN7EXAMPLE",
		"secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
	}); err != nil {
		t.Fatalf("Factory: %v", err)
	}
}
