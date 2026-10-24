# Approved: Implementation Spec

This is the build spec for the prototype. The design brief lives in the README; this file is the source of truth for rules, numbers, data and structure. All lending rules are **simplified for teaching** and the numbers are illustrative, not current market data.

## 1. One-line pitch and core lesson

You have 12 months to get mortgage-ready for a **$325,000** home. Each month you play financial moves that change your credit score, debt-to-income ratio (DTI) and cash. In month 12 the Underwriter decides how much house you qualify for and at what rate.

**Core lesson:** a lender reads a few numbers that pull against each other, and small differences in them become very large differences in what you can buy and what you pay over 30 years.

## 2. Scope and priorities

| Priority | What | Must ship? |
|---|---|---|
| P0 | Start screen, 12-month loop, cards, events, stat panel with previews, underwriting reveal, result screen with lessons | Yes |
| P0 | Deployed on Vercel, README complete | Yes |
| P1 | Engine unit tests (Vitest), seeded RNG with a "play this seed again" button, keyboard support, mobile-friendly layout | Strongly wanted |
| P2 | Habits (relics) picked at months 4 and 8, sound, animations with Framer Motion | Nice to have |
| P3 | Phaser 3 layer for the underwriting reveal (stamp, confetti particles) | Bonus only |

Rule: do not start a P(n+1) item until all P(n) items work end to end.

## 3. Screens and flow

```
Start ──▶ Month loop (×12) ──▶ Underwriting reveal ──▶ Result
            │  1 Paycheck
            │  2 Life event (may ask a choice)
            │  3 Draw hand, spend energy on cards
            │  4 End month (interest, overdraft check)
```

1. **Start screen.** Title, one-paragraph setup ("You earn $90k, rent in the city, and want a $325k starter home in a year"), the three numbers lenders check with a one-line plain-English definition each, a "Start" button, a "How to play" disclosure.
2. **Game screen.** Layout: stat panel (left or top on mobile), month tracker (1–12), event banner, hand of cards, energy pips, "End month" button, a small log of what happened.
3. **Underwriting reveal.** Step-by-step checklist that animates one line at a time: credit score gate, cash for down payment + closing + reserves, DTI at the target price, then the rate being built tier by tier (base rate + credit adjustment + down payment adjustment).
4. **Result screen.** Outcome badge, the numbers (max price, rate, monthly payment, 30-year interest), a "what if" comparison, 2–3 lessons drawn from what the player actually did, "Play again" and "Same seed" buttons.

## 4. State model

```ts
type Account = {
  id: string;
  kind: 'revolving' | 'installment';
  name: string;
  ageYears: number;        // grows by 1/12 each month
  balance: number;
  limit?: number;          // revolving only
  monthlyPayment?: number; // installment only; revolving min payment is derived as 3% of balance
  open: boolean;
};

type PlayerState = {
  month: number;                // 1..12
  cash: number;
  grossMonthlyIncome: number;   // only verified income, used for DTI
  unverifiedIncome: number;     // side gig etc., adds cash but NOT counted for DTI
  monthlySurplus: number;       // cash added every paycheck after rent and living costs
  accounts: Account[];
  missedPayments: number;
  hardInquiries: number;        // in the last 12 months
  targetPrice: number;
  baseRate: number;             // percent, e.g. 6.25
  flags: Record<string, boolean>; // autopay, plus "card:<id>" / "event:<id>:<choice>" markers for lessons
  energy: number;
  hand: CardId[];
  deck: CardId[];
  discard: CardId[];
  event: { eventId: EventId; resolved: boolean } | null; // this month's event; cards are blocked until resolved
  log: LogEntry[];
  seed: number;     // the run's seed, for "Replay this seed"
  rngState: number; // seeded generator position; the reducer saves it back after every random draw
};
```

The reducer wraps this in `GameState = { phase: 'start' } | { phase: 'playing' | 'underwriting' | 'result'; player: PlayerState }`. Ending month 12 moves to `underwriting` (the reveal); `SHOW_RESULT` moves on to `result`.

Derived values are **pure functions**, never stored: `creditScore(state)`, `utilization(state)`, `dti(state, housingPayment)`, `underwrite(state)`.

## 5. Starting state

| Field | Value |
|---|---|
| Gross monthly income | $7,500 ($90k/yr) |
| Cash | $22,000 |
| Monthly surplus | $700 |
| Target price | $325,000 |
| Base rate | 6.25% |
| Missed payments | 1 |
| Hard inquiries | 1 |

Accounts:

| Name | Kind | Age (yr) | Balance | Limit | Monthly payment |
|---|---|---|---|---|---|
| Old Faithful Visa | revolving | 8 | $2,500 | $3,000 | 3% of balance |
| Rewards Card | revolving | 2 | $2,000 | $3,000 | 3% of balance |
| Car Loan | installment | 3 | $9,000 | | $380 |
| Student Loan | installment | 6 | $24,000 | | $250 |

With these numbers the starting score is **656** and a player who does nothing qualifies for roughly **$278k**, short of the $325k target. Good play reaches $310k–$365k. Closing the oldest card drops the score to about **618**, below the 620 gate. These outcomes are intentional; keep them when tuning.

**Balance (milestone 6).** `src/engine/__tests__/balance.test.ts` plays 100 seeds per strategy and locks these bands in (`BALANCE_REPORT=1 npm test` prints the table). Measured after tuning:

| Strategy | Approved | Median max price | Band enforced |
|---|---|---|---|
| Idle: never plays a card, cautious event choices | 0% | $289k | 0% approved, median $275k–$300k |
| Random: uniform legal moves | 14% | $305k | 8–35% approved |
| Greedy: one-step lookahead on projected max price | 88% | $358k | 70–95% approved, median $310k–$365k |

Tuning changes: card interest is paid from cash instead of compounding the balance (an idle player's score no longer drifts from 656 to 634 by crossing a utilization tier), Side Gig pays $400/mo (was $600), Sell Unused Stuff pays $600 (was $900). Before tuning, greedy was approved 94% of the time with a $366k median.

## 6. Formulas

### 6.1 Credit score (simplified FICO-style, 300–850)

```
score = 300 + paymentHistory + utilizationPts + agePts + newCreditPts + mixPts

paymentHistory = max(0, 192 × (1 − 0.15 × missedPayments))     // ~35%
utilization u  = sum(revolving balances) / sum(revolving limits), open cards only
utilizationPts = u ≤ 10% → 165 | ≤ 30% → 140 | ≤ 50% → 100 | ≤ 75% → 60 | else 30   // ~30%
agePts         = min(82, averageAgeOfOpenAccounts × 8)          // ~15%
newCreditPts   = max(0, 55 − 15 × hardInquiries)                // ~10%
mixPts         = has open revolving AND open installment → 55, else 30   // ~10%
```

Round to an integer. Show the five components in the stat panel tooltip; this is part of the teaching.

### 6.2 DTI

```
otherDebts = sum(monthlyPayment of open accounts)
dti(housing) = (otherDebts + housing) / grossMonthlyIncome
```

Unverified income never enters this formula. Rent is not a debt and is not included.

### 6.3 Housing payment (PITI)

```
loan       = price × (1 − downPct)
P&I        = standard amortizing payment, 30 years, annual rate r
taxesIns   = price × 0.0015 per month
pmi        = downPct < 20% ? loan × 0.007 / 12 : 0
PITI       = P&I + taxesIns + pmi
```

### 6.4 Rate

```
rate = baseRate + creditAdj(score) + downAdj(downPct)

creditAdj: ≥760 → 0 | 740–759 → 0.125 | 720–739 → 0.25 | 700–719 → 0.375
           680–699 → 0.5 | 660–679 → 0.75 | 640–659 → 1.0 | 620–639 → 1.25
downAdj:   ≥20% → 0 | 10–19.99% → 0.125 | 3–9.99% → 0.25
```

### 6.5 Underwriting

`underwrite(state)` returns a full breakdown used by the reveal screen:

1. **Credit gate.** Score < 620 → `DENIED` with reason "credit".
2. Search price from $100,000 to $800,000 in $1,000 steps. For each price:
   - closing costs = 3% of price
   - reserves required = 2 × PITI
   - downPct = min(20%, (cash − closing − reserves) / price), solved by a few fixed-point iterations because PITI depends on downPct
   - reject if downPct < 3% (reason "cash")
   - reject if DTI > 43% (reason "dti")
3. The highest passing price is `maxPrice`. Record which constraint stopped the next step up (`bindingConstraint`: `cash` or `dti`). This is the most important teaching fact on the result screen.
4. Outcome: `maxPrice ≥ targetPrice` → `APPROVED`; `maxPrice ≥ 0.85 × targetPrice` → `APPROVED_SMALLER`; no passing price → `DENIED`; otherwise `APPROVED_SMALLER` with a warning tone.

Also return, at the target price (or maxPrice if lower): rate with its tier breakdown, monthly PITI, total interest over 30 years, and the same numbers for a score 40 points higher (the "what if").

## 7. Month loop rules

1. **Paycheck:** `cash += monthlySurplus + unverifiedIncome`. Account ages +1/12.
2. **Event:** draw one event from the event deck (seeded). If it has a choice, block until the player picks.
3. **Hand:** draw 5 cards, energy = 3. Each card costs 1 or 2 energy. Unplayed cards go to discard. Reshuffle discard when deck is empty.
4. **End month:**
   - Card interest of 2% a month (24% APR) is paid from cash, as if the minimum payment covers it; revolving balances hold steady. Log the interest paid.
   - Installment balances drop by their payment's principal share (simplify: balance −= 0.6 × payment).
   - If `cash < 0`: move the shortfall onto the revolving card with most room. If any part of it doesn't fit, `missedPayments += 1` (unless `flags.autopay`) and set cash to 0.
   - An installment loan whose balance reaches 0 closes.

"Put it on a card" choices use the same rule: the card with the most room takes what fits and the rest comes out of cash. Cards that spend cash are unavailable when the player can't afford them, and each card states why it is unavailable.
5. After month 12, go to the reveal.

Every card and event choice must show a **preview** before committing: a list of stat deltas, including the derived ones (score, DTI, max price if it is cheap to compute). Use the same pure functions on a cloned state; do not hand-write preview numbers.

Preview details (`src/engine/preview.ts`):
- Stats compared: max home price, score, DTI, utilization, cash, monthly savings. Only stats that move are listed, except max price, which is always shown ("no change" is often the lesson, e.g. the side gig).
- DTI in the stat panel and previews is debts ÷ verified income **before housing**; the 43% limit is explained in its tooltip. This keeps "extra car payment doesn't lower DTI" visible instead of being blurred by cash changes.
- Chance cards (`odds` on the card) preview their success case, labelled "If it works" with the odds shown; the real roll happens only on play, so previews never leak the outcome.
- "End month" also previews its effect (interest, loan paydown, overdraft) before the player commits.
- Previews are shown on every card face, not on hover, so they work on touch screens. They show only the change as compact chips ("Score +29", "Cash −$1,000", "Utilization ↓ 58%"); the full before → after is in the chip's title and screen-reader text. Cards that can't be played hide their preview and show the reason instead. A change to monthly savings also shows its total by month 12 ("+$400/mo, +$4,400 by month 12"), because max price only reflects today's cash; without it, Side Gig and Move Somewhere Cheaper looked useless to a player reading the previews.

Game screen clarity (from the first play-test, where the screen read as too busy):
- The stat panel leads with max home price, then the three numbers the start screen introduced (score, DTI, cash) under "What the lender checks". Utilization and monthly savings are smaller supporting rows.
- After every move, each number that changed briefly shows its change ("+29") next to it.
- Month 1 shows a dismissible one-line tip about previews and the goal.
- Energy and "End month" live in a sticky action bar with a one-line end-of-month preview.
- The log shows the latest two entries, with the full history behind "Show all".

Polish (milestone 7):
- **Keyboard:** number keys play the card in that position (or pick an event option while one is waiting), E ends the month. Buttons show the key and set `aria-keyshortcuts`; hints are hidden on touch screens (`hover: none`).
- **Focus:** after every move, focus goes to the event heading if a choice is waiting, else the hand heading, else End month. It lands on a heading, never on a card or option, so a stray Enter can't make a choice for the player. The reveal starts focused on Skip and moves to Continue when done; the result screen focuses its headline.
- **Screen readers:** Play and Choose buttons are named after their card or option, the log is a polite live region, and the action bar's status line is `role="status"`.
- **Edge states:** the action bar explains why nothing can be done (event waiting, out of energy, nothing affordable) and warns when cash is negative before month end (`src/screens/monthNotice.ts`, tested).
- **Small screens:** the stat panel puts the three lender numbers side by side; tooltips become a card pinned near the bottom of the screen; the action bar puts energy and the button on one row.
- Tooltips can be dismissed with Escape without moving focus.

## 8. Cards

Deck starts with 2 copies of cards marked ×2, 1 copy otherwise. `once` cards are removed after being played. Every card has a `lesson` string shown on the result screen if the player played it.

| Id | Name | Cost | Effect | Lesson (short) |
|---|---|---|---|---|
| `pay_card_1k` ×2 | Pay Down a Card | 1 | cash −1,000; highest-utilization card balance −1,000 | Utilization is about 30% of your score and updates monthly |
| `balance_blitz` | Balance Blitz | 2 | cash −2,500 split across cards | Getting under 30%, then 10%, unlocks big jumps |
| `extra_car` | Extra Car Payment | 1 | cash −1,500; car balance −1,500 | Lowering a balance doesn't lower DTI; the payment is what counts |
| `pay_off_car` once | Pay Off the Car | 2 | cash −car balance; car account closed | Removing a monthly payment frees DTI room for housing |
| `side_gig` once | Start a Side Gig | 1 | unverifiedIncome +400 | Lenders usually want about 2 years of history before counting new income |
| `ask_raise` once | Ask for a Raise | 1 | 50%: income +5% (verified) | Same-employer raises count right away |
| `limit_increase` once | Request Limit Increase | 1 | Old Faithful limit +3,000 | More available credit lowers utilization without paying anything |
| `store_card` | Store Card Bonus | 1 | cash +200; inquiry +1; new revolving account, age 0, limit 1,500 | New accounts cost inquiries and lower average age |
| `close_old` once | Close Your Oldest Card | 1 | Old Faithful closed (balance moved to Rewards Card) | Closing old cards shortens history and raises utilization |
| `meal_prep` ×2 | Meal Prep Month | 1 | cash +400 | Cash covers down payment, closing costs and reserves |
| `sell_stuff` | Sell Unused Stuff | 2 | cash +600 | |
| `cheaper_place` once | Move Somewhere Cheaper | 2 | cash −800; monthlySurplus +300 | Recurring savings compound over the year |
| `autopay` once | Set Up Autopay | 1 | flags.autopay = true | Payment history is the largest score factor |
| `dispute` once | Dispute a Report Error | 1 | 40%: missedPayments −1 | Credit reports contain errors; checking is free |
| `consolidate` once | Personal Loan Consolidation | 1 | inquiry +1; card balances → new installment loan at 4% of balance per month | Can help utilization but adds a payment and an inquiry |

Card data lives in one typed `Record<CardId, CardDef>` (`src/data/cards.ts`), so the compiler flags a missing card; effects are pure functions `(state, rng) => state`. Balance Blitz splits in proportion to each card's balance.

## 9. Events

One per month. Weighted random, no immediate repeats. Events with a choice show both previews.

| Id | Name | Effect / choices |
|---|---|---|
| `quiet` | Quiet Month | nothing (weight 2) |
| `rent_hike` | Rent Goes Up | monthlySurplus −150 |
| `medical` | Urgent Care Bill | pay $1,200 cash **or** put it on a card |
| `car_trouble` | Car Breaks Down | repair $2,500 cash **or** on a card **or** finance a newer car: the trade-in closes the old car loan, new installment $450/mo, inquiry +1 |
| `prices_up` | Home Prices Climb | targetPrice × 1.03 |
| `rates_up` | Rates Tick Up | baseRate +0.25 |
| `rates_down` | Rates Ease | baseRate −0.25 |
| `tax_refund` | Tax Refund | cash +1,500 |
| `bonus` | Work Bonus | cash +2,000 |
| `wedding` | Friend's Wedding | go: $800 cash (the overdraft rule moves it to a card if short) **or** skip: nothing |
| `card_offer` | Pre-Approved Offer | accept: same as Store Card but limit 5,000, no cash **or** decline |
| `furniture_promo` | 0% Furniture Deal | finance: installment $120/mo, inquiry +1 **or** pass (only months 8–12; teaches not taking new credit right before applying) |

## 10. Result screen content

- **Outcome badge:** Approved / Approved for less / Denied, with the reason in one sentence.
- **Numbers:** max price vs target, rate (with the tier breakdown), monthly payment, 30-year total interest.
- **What if:** "With a score 40 points higher, your rate would be X% and you'd pay $Y less over 30 years."
- **Binding constraint:** "You were limited by DTI" or "You were limited by cash", with one sentence on which lever would have moved it.
- **Lessons:** up to 3 lessons from cards and events the player actually hit, prioritised by impact (closing old card, side gig not counting, paying off car, utilization).
- Buttons: Play again (new seed), Replay this seed (labelled "Replay this year").

Implementation notes:
- Lessons come from `src/engine/lessons.ts`, in this priority: close oldest card, side gig, pay off car, financing a car, financing furniture, utilization (a card paydown, or a generic note if the player ends above 30% without touching their cards), extra car payment, accepting a card offer, then any other card played that has a lesson.
- An approved player's binding constraint is framed as what set their ceiling ("Your $364k ceiling was set by debt-to-income"), not as a limit.
- The reveal adds a line every 0.75s, can be skipped, and shows everything at once under `prefers-reduced-motion`. Its text comes from `src/screens/revealSteps.ts` (pure, tested).

## 11. Architecture

Stack: **Vite + React + TypeScript**, plain CSS Modules (or Tailwind), **Vitest** for engine tests. State with `useReducer` + context; no external state library needed. Optional later: Framer Motion, Phaser 3.

```
src/
  engine/            # pure TypeScript, no React imports
    types.ts
    rng.ts           # seeded RNG (mulberry32)
    credit.ts        # creditScore + components
    mortgage.ts      # pmt, piti, rate tiers
    underwrite.ts
    reducer.ts       # actions: START, RESOLVE_EVENT, PLAY_CARD, END_MONTH, SHOW_RESULT, RESTART
    preview.ts       # diff two states into display deltas
    __tests__/
  data/
    cards.ts
    events.ts
    initialState.ts
  components/
    StatPanel.tsx  StatTooltip.tsx  Card.tsx  Hand.tsx  EnergyPips.tsx
    EventBanner.tsx  MonthTracker.tsx  DeltaPreview.tsx  Log.tsx
  screens/
    StartScreen.tsx  GameScreen.tsx  UnderwritingScreen.tsx  ResultScreen.tsx
  hooks/
    useGame.ts
  App.tsx
```

Principles: engine is framework-free and fully tested; components receive data via props and dispatch actions; no business logic in components; card and event content is data, not code branches.

## 12. Tests to write (P1)

- Starting state scores 656 and underwrites to about $278k.
- Closing the oldest card from the start drops the score below 620 and underwriting returns DENIED.
- Paying off the car lowers DTI and raises max price when cash is not the limit; paid from starting cash, it makes cash the binding constraint (the intended trade-off).
- Side gig increases cash but does not change DTI.
- Utilization tiers hit their boundaries correctly.
- Same seed and same actions produce the same game.

## 13. Build milestones (commit at each)

1. Scaffold Vite + React + TS, deploy blank app to Vercel.
2. Engine: credit, mortgage, underwrite + tests.
3. Reducer and data: cards, events, month loop (playable in a bare UI).
4. Game screen UI with stat panel and previews.
5. Start, underwriting reveal and result screens.
6. Balance pass by playing 5+ runs; tune numbers but keep section 5 outcomes.
7. Polish: responsive layout, keyboard, empty and edge states.
8. README sections filled, known issues listed, final deploy.
9. Stretch: habits, Phaser reveal.

## 14. Copy and tone

Speak to a nervous first-time buyer. Short sentences, no jargon without a one-line explanation, never shame the player. Every number on screen should be explainable in one tooltip sentence.
