openapi-generator generate \
   -i ./openapi.v1.json \
   -g bash -o ./sdks/bash \
   --global-property apiBasePath=/api
