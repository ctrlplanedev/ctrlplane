{{- define "ctrlplane.nodeSelector" -}}
{{- $nodeSelector := default .Values.global.nodeSelector .Values.nodeSelector -}}
{{- if $nodeSelector }}
nodeSelector:
  {{- toYaml $nodeSelector | nindent 2 }}
{{- end }}
{{- end -}}