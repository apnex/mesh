#!/bin/bash
if [[ $0 =~ ^(.*)/[^/]+$ ]]; then
	WORKDIR=${BASH_REMATCH[1]}
fi
source ${WORKDIR}/mod.driver

# inputs
APIHOST="http://localhost"
if [[ -n "${PROBE_SERVER_PORT}" ]]; then
	APIHOST+=":${PROBE_SERVER_PORT}"
fi
ITEM="connections"
INPUTS=()

# apiGet
apiGet() {
	local URL="${1}"
	local RESPONSE=$(curl -s -X GET "${URL}")
	printf "${RESPONSE}"
}

# run
run() {
	URL="${APIHOST}"
	URL+="/${ITEM}"
	if [[ -n "${URL}" ]]; then
		printf "[$(cgreen "INFO")]: api [$(cgreen "list")] ${ITEM} [$(cgreen "${URL}")]... " 1>&2
		echo "[$(ccyan "DONE")]" 1>&2
		apiGet "${URL}"
	fi
}

# driver
driver "${@}"
