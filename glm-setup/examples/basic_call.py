"""Path B · The official Z.AI Python SDK — your first call.

Install:  pip install zai-sdk
Run:      export ZAI_API_KEY="your-api-key" && python basic_call.py

For streaming, add stream=True and loop over the chunks. The docs at
docs.z.ai have the full streaming example, plus a Java SDK if that is
your stack.
"""

import os

from zai import ZaiClient

client = ZaiClient(api_key=os.environ["ZAI_API_KEY"])

response = client.chat.completions.create(
    model="glm-5.2",
    messages=[
        {"role": "system", "content": "You are a senior full-stack software engineer."},
        {
            "role": "user",
            "content": "Design and build a personal blog website with a homepage, "
            "article list, and article detail page, using React + Node.js.",
        },
    ],
    thinking={"type": "enabled"},
    reasoning_effort="max",
    max_tokens=4096,
    temperature=1.0,
)

print(response.choices[0].message)
