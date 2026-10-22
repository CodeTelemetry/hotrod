#!/usr/bin/env bash
set -euo pipefail
: "${TEST_LOCATION_ADDR:?Set TEST_LOCATION_ADDR to a live location service}"
: "${TEST_FRONTEND_ADDR:?Set TEST_FRONTEND_ADDR to a live frontend service}"
: "${TEST_TARGET_WORKLOAD:?Set TEST_TARGET_WORKLOAD to the workload under test}"
go test -timeout 60s -count=1 -v -run '^(TestLocationClient|TestFrontendAPI)$' ./services/location ./services/frontend
