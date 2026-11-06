#!/bin/sh
set -eu
if [ -n "${DOMAIN:-}" ]; then
  GLOBAL=""
  if [ -n "${ACME_EMAIL:-}" ]; then
    GLOBAL="{
  email ${ACME_EMAIL}
}"
  fi
  cat > /etc/caddy/Caddyfile <<EOF
${GLOBAL}
${DOMAIN} {
	encode gzip
	handle /api/* {
		reverse_proxy api:8080 {
			flush_interval -1
		}
	}
	handle {
		root * /srv
		try_files {path} /index.html
		file_server
	}
}
EOF
else
  cp /etc/caddy/Caddyfile.http /etc/caddy/Caddyfile
fi
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
