// Package awssm implements a secrets.Provider backed by AWS Secrets Manager.
//
// SecretReference shape:
//
//	Provider: secret_provider.name in the workspace
//	Path:     secret name or ARN (e.g. "prod/db" or
//	          "arn:aws:secretsmanager:us-east-1:123:secret:prod/db-AbCdEf")
//	Key:      optional. If empty, the full SecretString is returned. If set,
//	          the SecretString is treated as JSON and the named field is
//	          extracted via gjson (dotted paths supported).
package awssm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	"github.com/tidwall/gjson"
	"workspace-engine/pkg/secrets"
)

const Type = "aws_secrets_manager"

// Config is the decrypted config payload for an aws_secrets_manager row.
// AccessKeyID + SecretAccessKey are both optional, but if one is set the
// other must be too. When both are absent the SDK's default credential chain
// is used (IRSA / instance role / shared config / env).
type Config struct {
	Region          string `json:"region"`
	AccessKeyID     string `json:"accessKeyId,omitempty"`
	SecretAccessKey string `json:"secretAccessKey,omitempty"`
}

func (c Config) validate() error {
	if c.Region == "" {
		return fmt.Errorf("awssm provider: region is required")
	}
	if (c.AccessKeyID == "") != (c.SecretAccessKey == "") {
		return fmt.Errorf(
			"awssm provider: accessKeyId and secretAccessKey must both be set or both omitted",
		)
	}
	return nil
}

// secretsClient is the subset of secretsmanager.Client the provider uses.
// Tests substitute a fake implementation; production uses the real SDK client.
type secretsClient interface {
	GetSecretValue(
		ctx context.Context,
		params *secretsmanager.GetSecretValueInput,
		optFns ...func(*secretsmanager.Options),
	) (*secretsmanager.GetSecretValueOutput, error)
}

type Provider struct {
	client secretsClient
}

// Factory matches secrets.ProviderFactory.
func Factory(raw json.RawMessage) (secrets.Provider, error) {
	var cfg Config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("awssm provider: parse config: %w", err)
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	awsCfg, err := buildAWSConfig(context.Background(), cfg)
	if err != nil {
		return nil, err
	}
	return &Provider{client: secretsmanager.NewFromConfig(awsCfg)}, nil
}

func buildAWSConfig(ctx context.Context, cfg Config) (aws.Config, error) {
	loadOpts := []func(*awsconfig.LoadOptions) error{awsconfig.WithRegion(cfg.Region)}
	if cfg.AccessKeyID != "" && cfg.SecretAccessKey != "" {
		loadOpts = append(
			loadOpts,
			awsconfig.WithCredentialsProvider(
				credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
			),
		)
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, loadOpts...)
	if err != nil {
		return aws.Config{}, fmt.Errorf("awssm provider: load AWS config: %w", err)
	}
	return awsCfg, nil
}

func (*Provider) Type() string { return Type }

// isVersionStage returns true if version names a Secrets Manager
// VersionStage label rather than a VersionId. AWS-defined stages are
// AWSCURRENT, AWSPREVIOUS, and AWSPENDING; user-defined stages can be any
// label up to 64 characters but cannot start with "AWS" unless they are
// the AWS-defined ones above. We treat any value that starts with "AWS"
// (case-insensitive) as a stage; UUIDs and other arbitrary identifiers
// fall through to VersionId. Callers can also opt-in with a sentinel
// prefix "stage:" (e.g. "stage:my-custom-stage") for user-defined stages.
func isVersionStage(version string) bool {
	const stagePrefix = "stage:"
	if strings.HasPrefix(version, stagePrefix) {
		return true
	}
	return strings.HasPrefix(strings.ToUpper(version), "AWS")
}

func (p *Provider) Resolve(ctx context.Context, ref secrets.SecretReference) (string, error) {
	if ref.Path == "" {
		return "", fmt.Errorf(
			"awssm provider: SecretReference.Path is required (secret name or ARN)",
		)
	}

	input := &secretsmanager.GetSecretValueInput{
		SecretId: aws.String(ref.Path),
	}
	if ref.Version != "" {
		// AWS Secrets Manager distinguishes VersionId (a UUID identifying a
		// specific historical version) from VersionStage (a label like
		// AWSCURRENT or AWSPREVIOUS). All-uppercase labels starting with
		// "AWS" are treated as stages; everything else as a version id.
		if isVersionStage(ref.Version) {
			input.VersionStage = aws.String(strings.TrimPrefix(ref.Version, "stage:"))
		} else {
			input.VersionId = aws.String(ref.Version)
		}
	}

	out, err := p.client.GetSecretValue(ctx, input)
	if err != nil {
		return "", fmt.Errorf("awssm provider: GetSecretValue %s: %w", ref.Path, err)
	}
	if out.SecretString == nil {
		return "", fmt.Errorf("awssm provider: secret %s has no SecretString payload", ref.Path)
	}

	if ref.Key == "" {
		return *out.SecretString, nil
	}

	r := gjson.Get(*out.SecretString, ref.Key)
	if !r.Exists() {
		return "", fmt.Errorf(
			"awssm provider: secret %s has no JSON field %q",
			ref.Path,
			ref.Key,
		)
	}
	return r.String(), nil
}
