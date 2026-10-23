# PLAYROOM

A responsive, free-to-play game discovery site built with React, TypeScript, and Vite. The Neon Vault case-opening demo uses virtual items only: there are no purchases, accounts, deposits, prizes, or cash-outs.

## Notice

PLAYROOM is a fictional entertainment demo, not a gambling service. It does not accept or involve real money, offer items with monetary value, or award prizes. Case openings, European roulette spins, and Lucky Wheel spins are simulated for fun only; roulette and the Lucky Wheel use pretend chips with no cash value. Each roulette number has a 1-in-37 chance, standard European payouts are used, and the 2.70% house edge is shown in-game for educational purposes. The Lucky Wheel has twelve weighted prize slots whose weights sum to 100, so each weight is also its percentage chance; the prize is selected with a cryptographically secure random draw before the wheel animates. A spin costs 10, 25, 50, or 100 chips, and the prizes scale with the chosen stake, so the 9.6% house edge is the same at every stake and is shown in-game. There are no deposits, purchases, withdrawals, or cash-outs.

## Lucky Wheel

The prize engine lives in `src/games/LuckyWheelGamePage/engine` and is the only place a winner is decided:

- `prizeConfig.ts` — the active twelve-slot configuration, the available stakes, and the default stake.
- `payouts.ts` — the single definition of the money rules: a prize's multiplier and the chips it pays at a given stake.
- `validateConfig.ts` — rejects negative, non-finite, or zero-total weights, duplicate prize ids, invalid reward amounts, invalid stakes, and any prize that would not pay whole chips at every allowed stake.
- `random.ts` / `selectPrize.ts` — a cryptographically secure draw plus weighted selection (`weight / totalWeight`).
- `spinService.ts` — load → validate → draw → select → persist → settle, including the stake debit and the balance check.
- `store.ts` — the balance and spin log. The game uses an in-memory store, so every session starts with 1,000 chips and an empty history, exactly like the other games.

Chip prizes are quoted at the default 25-chip stake: a 250-chip prize at 25 chips pays 100 at a 10-chip stake, 500 at 50, and 1,000 at 100. Because every payout scales by the same factor, the 90.4% return to player holds at every stake.

`src/games/LuckyWheelGamePage/geometry.ts` turns the server-selected slot id into the final wheel rotation, so the pointer always stops on the slot that was paid out. The animation never picks a prize.

## Tests

```bash
npm test
```

Vitest covers the configuration validation, the weighted selection algorithm, the observed prize distribution against the theoretical one, the final-rotation geometry, and the spin service.
