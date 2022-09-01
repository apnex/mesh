#!/bin/bash
export PROBE_SERVER_PORT=4040

read -r -d "" PROBES <<-EOF
	http://127.0.0.1:4041/links
EOF

IFS=$'\n'
COUNT=0
for PROBE in ${PROBES}; do
	./cmd.probes.create.sh probe${COUNT} "${PROBE}"
	COUNT=$((COUNT+1))
done

