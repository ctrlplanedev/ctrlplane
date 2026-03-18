package terraformcloud

import (
	"fmt"

	"github.com/hashicorp/go-tfe"
	"workspace-engine/pkg/oapi"
)

type tfeConfig struct {
	address            string
	token              string
	organization       string
	template           string
	webhookUrl         string
	triggerRunOnChange bool
}

func parseJobAgentConfig(jobAgentConfig oapi.JobAgentConfig) (*tfeConfig, error) {
	address, ok := jobAgentConfig["address"].(string)
	if !ok {
		return nil, fmt.Errorf("address is required")
	}
	token, ok := jobAgentConfig["token"].(string)
	if !ok {
		return nil, fmt.Errorf("token is required")
	}
	organization, ok := jobAgentConfig["organization"].(string)
	if !ok {
		return nil, fmt.Errorf("organization is required")
	}
	template, ok := jobAgentConfig["template"].(string)
	if !ok {
		return nil, fmt.Errorf("template is required")
	}
	if address == "" || token == "" || organization == "" || template == "" {
		return nil, fmt.Errorf("missing required fields in job agent config")
	}

	webhookUrl, _ := jobAgentConfig["webhookUrl"].(string)

	triggerRunOnChange := true
	if v, ok := jobAgentConfig["triggerRunOnChange"]; ok {
		switch val := v.(type) {
		case bool:
			triggerRunOnChange = val
		case string:
			triggerRunOnChange = val != "false"
		}
	}

	return &tfeConfig{
		address:            address,
		token:              token,
		organization:       organization,
		template:           template,
		webhookUrl:         webhookUrl,
		triggerRunOnChange: triggerRunOnChange,
	}, nil
}

func getClient(address, token string) (*tfe.Client, error) {
	client, err := tfe.NewClient(&tfe.Config{
		Address: address,
		Token:   token,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Terraform Cloud client: %w", err)
	}
	return client, nil
}
