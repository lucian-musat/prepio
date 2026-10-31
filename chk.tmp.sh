cd ~/projects/prepio_new
git config --global --get-all safe.directory >/dev/null
pnpm test 2>&1 | tail -8; pnpm typecheck 2>&1 | tail -5
git add -A && git status --short
git commit -q -m "chore: deployment config and docs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" && git rev-parse --short HEAD
git push origin main 2>&1 | tail -3
