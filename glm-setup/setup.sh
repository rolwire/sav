#!/usr/bin/env bash
# GLM-5.2 (Z.AI) one-command setup for Mac / Linux.
# Installs the Z.AI Python SDK and the OpenAI SDK, verifies both,
# then runs the 60-second key test if ZAI_API_KEY is set.

set -euo pipefail
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python is not installed. Install it from https://www.python.org/downloads/ and re-run." >&2
  exit 1
fi

echo "==> Installing zai-sdk (Path B) and openai>=1.0 (Path C)..."
"$PY" -m pip install --upgrade zai-sdk 'openai>=1.0'

echo "==> Verifying installs..."
"$PY" -c "import zai; print('zai-sdk', zai.__version__)"
"$PY" -c "import openai; print('openai', openai.__version__)"

if [ -n "${ZAI_API_KEY:-}" ]; then
  echo "==> ZAI_API_KEY found — running the 60-second cURL test..."
  ./test-key.sh
else
  cat <<'EOF'

Install complete. Next steps:
  1. Get an API key at https://z.ai (API console -> create key).
  2. export ZAI_API_KEY="your-api-key"
  3. ./test-key.sh                      # prove the key works
  4. python examples/basic_call.py      # Path B - Z.AI SDK
     python examples/openai_swap.py     # Path C - OpenAI swap
EOF
fi
