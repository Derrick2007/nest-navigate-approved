# Approved

A 12-month, card-based run where you get mortgage-ready before you apply.

**Play it:** https://nest-navigate-approved.vercel.app/

> Built for the Nest Navigate Full Stack Engineering assignment. Lending rules in the game are simplified for teaching and are not financial advice.

## Game Concept

**Approved** is a short roguelike-style card game about getting mortgage-ready.

**The concept.** Most first-time buyers don't get turned down or overcharged for one big reason. It's how a handful of numbers interact: credit score, debt-to-income ratio (DTI), down payment and cash reserves. Approved teaches how a lender actually reads those numbers.

**The mechanic.** Each turn is one month. You collect your paycheck, draw a hand of financial moves, and have limited energy to play a few: pay down a credit card, pay off a car loan, pick up a side gig, open a store card for the sign-up bonus, close your oldest card. Every card previews its effect before you commit. Random life events, like a rent hike, a medical bill or rising home prices, force trade-offs. After month 12 you face the Underwriter, who checks each stat against simplified real-world thresholds and builds your interest rate tier by tier.

**The learning outcome.** Players leave knowing what DTI is and why a $400 car payment shrinks their buying power, why closing an old card can lower their score, why brand-new side income may not count yet, and how a 40-point credit gap becomes tens of thousands of dollars over a 30-year loan.

**Why it's fun.** It borrows the roguelike loop: scarce actions, random draws, compounding choices and a big final calculation. Counterintuitive cards create "wait, really?" moments, and every run plays out differently, so replaying to beat your rate feels natural.

## How to Run Locally

Requires Node.js 20.19+ (developed on Node 26).

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 86 tests: engine, previews, lessons, balance simulations
npm run build    # type-check and production build
npm run lint     # oxlint
```

`BALANCE_REPORT=1 npm test` also prints the balance table (see below).

### How to play

Each month you get paid, face one life event, then spend up to 3 energy on cards. Every card shows what it would change before you play it: green helps, red hurts. Keep an eye on **max home price**, the most house you would be approved for today. After month 12 the Underwriter checks your numbers one by one and builds your rate. On a keyboard, number keys play a card or pick an event option and `E` ends the month.

## Tech Choices

- **Vite + React 19 + TypeScript.** Fast to set up and fast to iterate. Types earn their keep here because the game is mostly numbers: they catch a percent passed where a fraction was expected, or a card id with no definition.
- **A pure TypeScript engine (`src/engine/`), with no React in it.** Credit score, mortgage math, underwriting, the month loop and the lesson picker are plain functions of state. That is what makes the core features possible:
  - **Previews run the real rules.** Every card, event choice and "End month" shows its effect by running the actual effect on the current state and diffing the numbers, so a preview can never disagree with what happens.
  - **It is fully testable**, including whole simulated games.
- **Content is data (`src/data/`).** The 15 cards and 12 events are typed `Record<Id, Def>` entries with their effect, unavailability reason and lesson. Adding a card is one entry, and the compiler fails if an id has no definition.
- **`useReducer` + context, no state library.** One reducer (`START`, `RESOLVE_EVENT`, `PLAY_CARD`, `END_MONTH`, `SHOW_RESULT`, `RESTART`) wraps the engine. Derived numbers (score, DTI, max price) are computed with `useMemo`, never stored, so they cannot go stale.
- **Seeded RNG (mulberry32).** The generator's state lives in game state, so the reducer stays pure, "Replay this year" replays the same events and draws, and tests are deterministic.
- **CSS Modules + design tokens**, no UI library. The look is small and custom, and the bundle stays at about 87 kB gzipped.
- **Phaser 3 for the verdict (the bonus challenge).** At the end of the underwriting reveal, a rubber stamp (APPROVED / APPROVED FOR LESS / DENIED) slams down with a camera shake and an ink spatter, and a full approval fires confetti. React keeps all the game state; Phaser only draws (`src/phaser/stampGame.ts`). It is **lazy-loaded**: Phaser's ~320 kB gzipped chunk is fetched while the reveal lines play, so the first page load doesn't pay for it. The game is destroyed when the reveal unmounts, and under `prefers-reduced-motion` or a failed load it falls back to a static CSS stamp (`components/ApprovalStamp.tsx`).
- **Vitest** for 86 tests: every formula and card, reducer edge cases (event blocking, overdrafts, missed payments), same-seed determinism, 200 random runs checking state invariants, and balance tests (below).
- **Vercel**, deployed from GitHub on every push to `main`.

### Balance, measured instead of guessed

`src/engine/__tests__/simulate.ts` plays whole games with three automated players. The balance tests fail if a content change knocks the results outside these bands:

| Player | Approved | Median max price |
|---|---|---|
| Does nothing | 0% | $289k |
| Clicks randomly | 14% | $305k |
| Reads the previews (one-step lookahead) | 88% | $358k |

The first measurement found two problems. First, an idle player's score drifted down because card interest compounded them past a utilization tier. Second, good play won 94% of the time because two "free cash" cards were played in nearly every run. Both are fixed; the git history has the before and after.

### Project structure

```
src/
  engine/      pure game logic and its tests (credit, mortgage, underwrite, reducer, preview, lessons, rng)
  data/        cards, events, starting state
  components/  stat panel, cards, event banner, action bar, previews, tooltips
  screens/     start, game, underwriting reveal, result
  hooks/       game context, keyboard shortcuts, change flashes
  phaser/      the stamp-and-confetti scene, lazy-loaded on the reveal
docs/SPEC.md   rules, numbers and decisions; kept in sync with the code
```

## What I'd Do With More Time

- **Test with real first-time buyers.** The balance is tuned against automated players and my own runs. The real question is whether a nervous buyer leaves understanding DTI. I'd watch five people play and ask them to explain their result.
- **Show the year as a story on the result screen.** A small chart of max home price month by month, with the moves that moved it most, would make cause and effect obvious.
- **Save progress.** Refreshing the page loses the run. Saving the game state to `localStorage` under a schema version is a small change.
- **Habits** (planned P2): pick a lasting perk at months 4 and 8, such as "Autopay everything" or "Frugal streak", for more strategy and replay value.
- **Component tests** with React Testing Library for the screens. Today the tests cover the engine and the pure UI helpers (preview formatting, reveal steps, notices), not rendered components.
- **More scenarios**: different incomes and targets, FHA-style low-down-payment loans, gift funds, and inquiries that age off.

## Known Issues

- **The lending rules are simplified for teaching** and the numbers are illustrative, not current market data. For example: one 43% DTI limit, a flat 3% for closing costs, a five-part score model, and inquiries that count for the whole year.
- **A page refresh loses the current run** (no persistence yet).
- **Chance cards preview their success case.** Ask for a Raise (50%) and Dispute a Report Error (40%) show their odds next to the preview. The real roll only happens when the card is played, so a preview can't leak the result, but it is optimistic by design.
- **Max price only reflects today's cash.** Monthly savings changes show their total by month 12 next to the preview, but future rent hikes and events are not projected.
- **Accepting the pre-approved card offer usually raises the score.** With 75% card utilization, $5,000 of extra credit outweighs the inquiry and the newer account. That is honest under the model, but it softens the "don't open credit before you apply" message. The furniture deal in months 8–12 carries that lesson more cleanly.
- **When an overdraft can't fit on a card**, the shortfall is recorded as a missed payment and then written off rather than carried as debt. This keeps the rules simple.
- **Browser coverage:** tested in Chromium at desktop and phone sizes, including keyboard play. It has not been tested on real iOS Safari or Firefox. On touch screens, tooltips rely on tap-to-hover.
- **The Phaser stamp was verified through its scene state** (scale, angle, position inside the canvas, particle counts at each point in time) rather than by eye, because the automated browser used for testing doesn't draw WebGL frames in the background.
