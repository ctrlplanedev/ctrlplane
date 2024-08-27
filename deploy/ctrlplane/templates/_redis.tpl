{{- define "ctrlplane.redisUrl" -}}
{{- printf "postgresql://:%s@%s:%s" .Values.global.redis.password .Values.global.redis.host .Values.global.redis.porte   -}}
{{- end -}}