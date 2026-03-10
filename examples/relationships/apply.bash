export CTRLPLANE_API_KEY=$(grep '^api-key:' ~/.ctrlc.yaml | awk '{print $2}')
export CTRLPLANE_WORKSPACE=$(grep '^workspace:' ~/.ctrlc.yaml | awk '{print $2}')
export CTRLPLANE_URL=$(grep '^url:' ~/.ctrlc.yaml | awk '{print $2}')

echo "CTRLPLANE_WORKSPACE: $CTRLPLANE_WORKSPACE"
echo "CTRLPLANE_URL: $CTRLPLANE_URL"

terraform apply