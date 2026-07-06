# GLM-5.2 (Z.AI) one-command setup for Windows PowerShell.
# Installs the Z.AI Python SDK and the OpenAI SDK, verifies both,
# then runs the 60-second key test if ZAI_API_KEY is set.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
if (-not $py) {
    Write-Error "Python is not installed. Install it from https://www.python.org/downloads/ and re-run."
    exit 1
}

Write-Host "==> Installing zai-sdk (Path B) and openai>=1.0 (Path C)..."
& $py.Source -m pip install --upgrade zai-sdk "openai>=1.0"

Write-Host "==> Verifying installs..."
& $py.Source -c "import zai; print('zai-sdk', zai.__version__)"
& $py.Source -c "import openai; print('openai', openai.__version__)"

if ($env:ZAI_API_KEY) {
    Write-Host "==> ZAI_API_KEY found — running the 60-second key test..."
    $body = @{
        model = "glm-5.2"
        messages = @(
            @{ role = "system"; content = "You are a senior full-stack software engineer." }
            @{ role = "user"; content = "Design and build a personal blog website for me with a homepage, article list, and article detail page, using React + Node.js." }
        )
        thinking = @{ type = "enabled" }
        reasoning_effort = "max"
        max_tokens = 4096
        temperature = 1.0
    } | ConvertTo-Json -Depth 5

    Invoke-RestMethod -Method Post `
        -Uri "https://api.z.ai/api/paas/v4/chat/completions" `
        -Headers @{ Authorization = "Bearer $($env:ZAI_API_KEY)" } `
        -ContentType "application/json" `
        -Body $body
} else {
    Write-Host @"

Install complete. Next steps:
  1. Get an API key at https://z.ai (API console -> create key).
  2. [Environment]::SetEnvironmentVariable("ZAI_API_KEY", "your-api-key", "User")
     (then restart PowerShell)
  3. .\setup.ps1                        # re-run to test the key
  4. python examples\basic_call.py      # Path B - Z.AI SDK
     python examples\openai_swap.py     # Path C - OpenAI swap
"@
}
