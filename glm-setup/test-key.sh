#!/usr/bin/env bash
# Path A · The 60-second test (cURL)
# Proves your Z.AI API key works. If a response comes back, you are live.
#
# Usage:
#   export ZAI_API_KEY="your-api-key"
#   ./test-key.sh
#
# Want the response to stream in live instead of arriving all at once?
# Add  "stream": true  next to "max_tokens" and run it again.

set -euo pipefail

if [ -z "${ZAI_API_KEY:-}" ]; then
  echo "ZAI_API_KEY is not set. Run:  export ZAI_API_KEY=\"your-api-key\"" >&2
  exit 1
fi

curl -X POST "https://api.z.ai/api/paas/v4/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ZAI_API_KEY}" \
  -d '{
    "model": "glm-5.2",
    "messages": [
      {
        "role": "system",
        "content": "You are a senior full-stack software engineer."
      },
      {
        "role": "user",
        "content": "Design and build a personal blog website for me with a homepage, article list, and article detail page, using React + Node.js."
      }
    ],
    "thinking": { "type": "enabled" },
    "reasoning_effort": "max",
    "max_tokens": 4096,
    "temperature": 1.0
  }'
