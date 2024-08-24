{{- define "ctrlplane.priorityClassName" -}}
{{- $pcName := default .Values.global.priorityClassName .Values.priorityClassName -}}
{{- if $pcName }}
priorityClassName: {{ $pcName }}
{{- end -}}
{{- end -}}

{{- define "ctrlplane.podSecurityContext" -}}
{{- $psc := . }}
{{- if $psc }}
securityContext:
{{-   if not (empty $psc.runAsUser) }}
  runAsUser: {{ $psc.runAsUser }}
{{-   end }}
{{-   if not (empty $psc.runAsGroup) }}
  runAsGroup: {{ $psc.runAsGroup }}
{{-   end }}
{{-   if not (empty $psc.fsGroup) }}
  fsGroup: {{ $psc.fsGroup }}
{{-   end }}
{{-   if not (empty $psc.fsGroupChangePolicy) }}
  fsGroupChangePolicy: {{ $psc.fsGroupChangePolicy }}
{{-   end }}
{{- end }}
{{- end -}}