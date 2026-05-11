// Package awssm implements a secrets.Provider backed by AWS Secrets Manager.
//
// SecretReference shape:
//
//	Provider: secret_provider.name in the workspace
//	Path:     secret name or ARN (e.g. "prod/db" or
//	          "arn:aws:secretsmanager:us-east-1:123:secret:prod/db-AbCdEf")
//	Key:      optional. If empty, the full SecretString is returned. If set,
//	          the SecretString is treated as JSON and the named field is
//	          extracted via gjson.
package awssm

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	"github.com/tidwall/gjson"
	"workspace-engine/pkg/secrets"
)

const Type = "aws_secrets_manager"

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

// Factory matches secrets.ProviderFactory. The decrypted config supports:
//
//	region            (required)
//	accessKeyId       (optional)
//	secretAccessKey   (optional)
//
// When the static credentials are absent, the SDK default credential chain is
// used (instance role, IRSA, etc).
func Factory(cfg map[string]any) (secrets.Provider, error) {
	region, ok := cfg["region"].(string)
	if !ok || region == "" {
		return nil, fmt.Errorf("awssm provider: region is required")
	}
	awsCfg, err := buildAWSConfig(context.Background(), region, cfg)
	if err != nil {
		return nil, err
	}
	return &Provider{client: secretsmanager.NewFromConfig(awsCfg)}, nil
}

func buildAWSConfig(
	ctx context.Context,
	region string,
	cfg map[string]any,
) (aws.Config, error) {
	loadOpts := []func(*awsconfig.LoadOptions) error{awsconfig.WithRegion(region)}

	accessKeyID, hasAK := stringField(cfg, "accessKeyId")
	secretKey, hasSK := stringField(cfg, "secretAccessKey")
	switch {
	case hasAK && hasSK:
		loadOpts = append(
			loadOpts,
			awsconfig.WithCredentialsProvider(
				credentials.NewStaticCredentialsProvider(accessKeyID, secretKey, ""),
			),
		)
	case hasAK != hasSK:
		return aws.Config{}, fmt.Errorf(
			"awssm provider: accessKeyId and secretAccessKey must both be set or both omitted",
		)
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, loadOpts...)
	if err != nil {
		return aws.Config{}, fmt.Errorf("awssm provider: load AWS config: %w", err)
	}
	return awsCfg, nil
}

func stringField(cfg map[string]any, key string) (string, bool) {
	v, ok := cfg[key]
	if !ok {
		return "", false
	}
	s, ok := v.(string)
	return s, ok && s != ""
}

func (*Provider) Type() string { return Type }

func (p *Provider) Resolve(ctx context.Context, ref secrets.SecretReference) (string, error) {
	if ref.Path == "" {
		return "", fmt.Errorf(
			"awssm provider: SecretReference.Path is required (secret name or ARN)",
		)
	}

	out, err := p.client.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{
		SecretId: aws.String(ref.Path),
	})
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
