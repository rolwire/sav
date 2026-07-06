"""Path C · The 2-line OpenAI swap.

GLM-5.2 speaks the same language as the OpenAI SDK. Any tool, script, or
app you already built on OpenAI can run on GLM-5.2 by changing two lines:
the key and the base URL.

Install:  pip install --upgrade 'openai>=1.0'
Run:      export ZAI_API_KEY="your-api-key" && python openai_swap.py
"""

import os

from openai import OpenAI

# The two lines that matter:
client = OpenAI(
    api_key=os.environ["ZAI_API_KEY"],
    base_url="https://api.z.ai/api/paas/v4/",
)

completion = client.chat.completions.create(
    model="glm-5.2",
    messages=[
        {"role": "system", "content": "You are a senior full-stack software engineer."},
        {
            "role": "user",
            "content": "Design and build a personal blog website with a homepage, "
            "article list, and article detail page.",
        },
    ],
)

print(completion.choices[0].message.content)
