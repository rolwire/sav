# GLM-5.2 (Z.AI) — Install & Setup

Everything from the "Get your key, pick your path" guide, ready to run on your own computer.

The API lives at one address for every path: `https://api.z.ai/api/paas/v4`. The model name is always `glm-5.2`.

## Step 1 · Get an API key

1. Create an account at [z.ai](https://z.ai).
2. Open the API console and create an API key.
3. Copy it somewhere safe — every call uses this key, so treat it like a password.

Then set it as an environment variable so the scripts below can find it:

```bash
# Mac / Linux (add to ~/.bashrc or ~/.zshrc to make it permanent)
export ZAI_API_KEY="your-api-key"
```

```powershell
# Windows PowerShell (persists for your user account)
[Environment]::SetEnvironmentVariable("ZAI_API_KEY", "your-api-key", "User")
```

## Step 2 · Install everything (one command)

From this folder:

```bash
# Mac / Linux
./setup.sh
```

```powershell
# Windows PowerShell
.\setup.ps1
```

The script installs the Z.AI Python SDK (`zai-sdk`) and the OpenAI SDK (`openai>=1.0`), verifies both imports, and — if `ZAI_API_KEY` is set — runs the 60-second cURL test to prove your key works.

## Step 3 · Pick your path

| Path | Best for | File |
|---|---|---|
| A · cURL | The fastest possible test. One command, no installs. | `test-key.sh` |
| B · Z.AI Python SDK | Building something new in Python with full access to every GLM-5.2 feature. | `examples/basic_call.py` |
| C · OpenAI SDK swap | You already have code built on the OpenAI SDK. Change two lines and it runs on GLM-5.2. | `examples/openai_swap.py` |

Not sure? Run Path A first to prove the key works, then use Path C if you have existing tools, or Path B if you are starting fresh.

```bash
./test-key.sh                       # Path A — the 60-second test
python examples/basic_call.py       # Path B — Z.AI SDK
python examples/openai_swap.py      # Path C — OpenAI swap
```

## The four settings that matter

| Setting | What it does |
|---|---|
| `thinking` | Turns deep reasoning on or off. Keep it enabled for hard problems. |
| `reasoning_effort` | How hard it thinks. Use `"max"` for complex builds and audits. |
| `stream` | `true` streams the answer live instead of waiting for the whole thing. |
| `temperature` | Creativity dial. Lower is more precise, higher is more varied. |

## Run this first — the codebase takeover

The best first job for that 1M context: point it at a real project and ask for the full picture.

> Read the current project and output a system architecture map, core module
> responsibilities, key API contracts, major data flows, potential technical
> debt, and the engineering constraints to follow in future refactoring.

Other proven jobs: long refactors run end to end, holding the line on your team's engineering standards, mobile app debugging on a real device, and turning a research paper into runnable code.

## The whole setup in four lines

1. Create a Z.AI account and grab your API key.
2. Prove it works with the 60-second cURL test (`./test-key.sh`).
3. Pick your path: Z.AI SDK for new builds, the 2-line OpenAI swap for existing tools.
4. Run the codebase takeover prompt and watch the 1M context work.

For streaming and more, the docs at [docs.z.ai](https://docs.z.ai) have the full examples, plus a Java SDK if that is your stack.
