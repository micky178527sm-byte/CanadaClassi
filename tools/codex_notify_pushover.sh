#!/bin/zsh
set -u

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILES=(
  "${ROOT_DIR}/.env.local"
  "${ROOT_DIR}/tools/.env.local"
)

load_env_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
  fi
}

for env_file in "${ENV_FILES[@]}"; do
  load_env_file "$env_file"
done

if [[ "${1:-}" == "--test" ]]; then
  TITLE="Codex: TEST"
  BODY="Test message from codex_notify_pushover.sh"
else
  TITLE="${1:-}"
  BODY="${2:-}"
fi

if [[ -z "${PUSHOVER_USER_KEY:-}" || -z "${PUSHOVER_APP_TOKEN:-}" ]]; then
  echo "Pushover keys missing; skip notify" >&2
  exit 0
fi

if [[ -z "${TITLE}" || -z "${BODY}" ]]; then
  echo "Pushover notify skipped: title/body missing" >&2
  exit 0
fi

set +e
RESP_FILE="$(mktemp)"
HTTP_CODE="$(curl -sS -w "%{http_code}" -o "${RESP_FILE}" https://api.pushover.net/1/messages.json \
  --form-string "token=${PUSHOVER_APP_TOKEN}" \
  --form-string "user=${PUSHOVER_USER_KEY}" \
  --form-string "title=${TITLE}" \
  --form-string "message=${BODY}" \
  --form-string "priority=0")"
CURL_EXIT=$?
set -e

if [[ "${CURL_EXIT}" -ne 0 ]]; then
  echo "Pushover notify failed (curl exit ${CURL_EXIT})" >&2
  rm -f "${RESP_FILE}"
  exit 0
fi

if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "Pushover notify failed (HTTP ${HTTP_CODE})" >&2
  if [[ -s "${RESP_FILE}" ]]; then
    echo "Pushover response: $(cat "${RESP_FILE}")" >&2
  fi
  rm -f "${RESP_FILE}"
  exit 0
fi

rm -f "${RESP_FILE}"
exit 0
