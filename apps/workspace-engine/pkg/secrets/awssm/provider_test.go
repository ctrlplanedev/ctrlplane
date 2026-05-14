package awssm

import (
	"context"
	"encoding/json"
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

func mustMarshal(t *testing.T, cfg Config) json.RawMessage {
	t.Helper()
	raw, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	return raw
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

func TestResolveVersionId(t *testing.T) {
	fc := &fakeClient{
		out: &secretsmanager.GetSecretValueOutput{SecretString: aws.String("v")},
	}
	p := &Provider{client: fc}

	_, err := p.Resolve(context.Background(), secrets.SecretReference{
		Path:    "prod/db",
		Version: "ab12cd34-ef56-7890-abcd-ef1234567890",
	})
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if fc.in.VersionId == nil || *fc.in.VersionId != "ab12cd34-ef56-7890-abcd-ef1234567890" {
		t.Fatalf("expected VersionId to be set, got %+v", fc.in.VersionId)
	}
	if fc.in.VersionStage != nil {
		t.Fatalf("VersionStage must not be set for a UUID version, got %q", *fc.in.VersionStage)
	}
}

func TestResolveVersionStageAWSCURRENT(t *testing.T) {
	fc := &fakeClient{
		out: &secretsmanager.GetSecretValueOutput{SecretString: aws.String("v")},
	}
	p := &Provider{client: fc}

	_, err := p.Resolve(context.Background(), secrets.SecretReference{
		Path:    "prod/db",
		Version: "AWSCURRENT",
	})
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if fc.in.VersionStage == nil || *fc.in.VersionStage != "AWSCURRENT" {
		t.Fatalf("expected VersionStage=AWSCURRENT, got %+v", fc.in.VersionStage)
	}
	if fc.in.VersionId != nil {
		t.Fatalf("VersionId must not be set for a stage, got %q", *fc.in.VersionId)
	}
}

func TestResolveVersionUserStageWithPrefix(t *testing.T) {
	fc := &fakeClient{
		out: &secretsmanager.GetSecretValueOutput{SecretString: aws.String("v")},
	}
	p := &Provider{client: fc}

	_, err := p.Resolve(context.Background(), secrets.SecretReference{
		Path:    "prod/db",
		Version: "stage:custom-pin",
	})
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if fc.in.VersionStage == nil || *fc.in.VersionStage != "custom-pin" {
		t.Fatalf("expected VersionStage=custom-pin, got %+v", fc.in.VersionStage)
	}
}

func TestResolveNoVersionPassthrough(t *testing.T) {
	fc := &fakeClient{
		out: &secretsmanager.GetSecretValueOutput{SecretString: aws.String("v")},
	}
	p := &Provider{client: fc}

	_, err := p.Resolve(context.Background(), secrets.SecretReference{Path: "prod/db"})
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if fc.in.VersionId != nil {
		t.Fatalf("VersionId must be nil when no version specified")
	}
	if fc.in.VersionStage != nil {
		t.Fatalf("VersionStage must be nil when no version specified")
	}
}

func TestResolveExtractsJSONFieldByKey(t *testing.T) {
	fc := &fakeClient{
		out: &secretsmanager.GetSecretValueOutput{
			SecretString: aws.String(
				`{"username":"app","password":"hunter2","nested":{"k":"v"}}`,
			),
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
		raw  json.RawMessage
	}{
		{"not json", json.RawMessage(`not-json`)},
		{"missing region", mustMarshal(t, Config{})},
		{
			"partial creds (key only)",
			mustMarshal(t, Config{Region: "us-east-1", AccessKeyID: "AKIA..."}),
		},
		{
			"partial creds (secret only)",
			mustMarshal(t, Config{Region: "us-east-1", SecretAccessKey: "secret"}),
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := Factory(c.raw); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}

func TestFactoryAcceptsRegionOnly(t *testing.T) {
	if _, err := Factory(mustMarshal(t, Config{Region: "us-east-1"})); err != nil {
		t.Fatalf("Factory: %v", err)
	}
}

func TestFactoryAcceptsStaticCreds(t *testing.T) {
	if _, err := Factory(mustMarshal(t, Config{
		Region:          "us-east-1",
		AccessKeyID:     "AKIAIOSFODNN7EXAMPLE",
		SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
	})); err != nil {
		t.Fatalf("Factory: %v", err)
	}
}
