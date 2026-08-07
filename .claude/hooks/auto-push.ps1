# Auto commit + push (GitHub) and apply pending Supabase migrations when Claude Code
# finishes working in this project. Wired as a project Stop hook in .claude/settings.json.
# Safe no-op when nothing changed or when checks fail.
$ErrorActionPreference = 'SilentlyContinue'
$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $repoRoot

if (-not (git rev-parse --is-inside-work-tree)) { exit 0 }

# --- GitHub: commit + push only if the quality gate passes ---
if (git status --porcelain) {
    Write-Host "[auto-push] Changes detected, running 'npm run verificar'..."
    npm run verificar
    if ($LASTEXITCODE -eq 0) {
        git add -A
        git commit -q -m "chore: auto-save $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        git push -q
        Write-Host "[auto-push] Pushed to GitHub."
    } else {
        Write-Host "[auto-push] 'npm run verificar' failed - skipping commit/push. Fix errors and it will retry next time."
    }
}

# --- Supabase: apply pending migrations if the project is linked ---
if (Test-Path "supabase/.temp/project-ref") {
    Write-Host "[auto-push] Applying pending Supabase migrations..."
    npx supabase db push --yes
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[auto-push] Supabase migrations up to date."
    } else {
        Write-Host "[auto-push] 'supabase db push' failed - check migrations manually."
    }
}

exit 0
