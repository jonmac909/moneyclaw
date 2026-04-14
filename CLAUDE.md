# MoneyClaw — Project Rules

## AUTO-SAVE: Commit and push after EVERY change
After completing any code edit (feature, fix, UI change, refactor), you MUST:
1. `git add` the changed files
2. `git commit` with a clear message
3. `git push origin main`

Do this automatically without being asked. Never let work accumulate as uncommitted changes.

## Never run destructive git commands
- NEVER run `git checkout -- <file>` to revert uncommitted work
- NEVER run `git reset --hard`
- If you need to undo something, make a NEW commit that fixes it
- Always commit BEFORE trying risky changes

## Tech stack
- Single-file React app: `MoneyClaw.jsx`
- Vite dev server on port 5173
- Plaid backend: `plaid-server/server.js` on port 8484
- Data: `moneyclaw-data.json` (gitignored — contains financial data)
- Repo: https://github.com/jonmac909/moneyclaw

## Color palette
- Primary accent: crab orange `#e05a47`
- Positive/income: muted blue-gray `#A3B4C8` (NOT neon green)
- Gold/bars: warm orange `#CC6D3D`
- Keep palette minimal, warm, cohesive — no rainbow, no neon
