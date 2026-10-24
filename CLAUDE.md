# Project context for Claude

This repo is Derrick's take-home for the Nest Navigate Full Stack Engineering role: a React mini game that teaches first-time homebuyers one concept. Deadline is 48 hours from Oct 23, 2026 (an extension is available if needed).

- Game: **Approved**, a 12-month card game about getting mortgage-ready (credit score, DTI, cash). Design brief is in `README.md`.
- **`docs/SPEC.md` is the source of truth** for rules, numbers, cards, events, architecture and milestones. Follow it; if a change is needed, update the spec in the same commit.
- Evaluation weights: product thinking 20%, code quality 30%, UX & polish 25%, delivery & communication 25%. They read the git history.

## Working rules

- Stack: Vite + React + TypeScript, Vitest, `useReducer` + context. No backend, no external APIs.
- Keep `src/engine/` pure TypeScript with no React imports, and test it.
- Card and event content is data in `src/data/`, not branches in components.
- Scope ruthlessly: finish the P0 slice end to end before any P1/P2/P3 work.
- Commit small and often with clear messages, one milestone step at a time.
- Lending rules are simplified for teaching; keep the "not financial advice" note in the README.
- Derrick must be able to explain every file in the follow-up interview, so prefer clear code over clever code and explain non-obvious decisions in short comments.
