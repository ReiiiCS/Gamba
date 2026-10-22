# PLAYROOM

A responsive, free-to-play game discovery site built with React, TypeScript, and Vite. The Neon Vault case-opening demo uses virtual items only: there are no purchases, accounts, deposits, prizes, or cash-outs.

## Notice

PLAYROOM is a fictional entertainment demo, not a gambling service. It does not accept or involve real money, offer items with monetary value, or award prizes. Case openings, European roulette spins, and Lucky Wheel spins are simulated for fun only; roulette and the Lucky Wheel use pretend chips with no cash value. Each roulette number has a 1-in-37 chance, standard European payouts are used, and the 2.70% house edge is shown in-game for educational purposes. The Lucky Wheel has twelve weighted prize slots whose weights sum to 100, so each weight is also its percentage chance; the prize is selected with a cryptographically secure random draw before the wheel animates, and the 9.6% house edge is shown in-game. There are no deposits, purchases, withdrawals, or cash-outs.

## Lucky Wheel

The prize engine lives in `src/games/LuckyWheelGamePage/engine` and is the only place a winner is decided:

- `prizeConfig.ts` — the active twelve-slot configuration and the stake.
- `validateConfig.ts` — rejects negative, non-finite, or zero-total weights, duplicate prize ids, and invalid reward amounts.
- `random.ts` / `selectPrize.ts` — a cryptographically secure draw plus weighted selection (`weight / totalWeight`).
- `spinService.ts` — load → validate → draw → select → persist → settle.
- `store.ts` — balance and spin log persistence.

`src/games/LuckyWheelGamePage/geometry.ts` turns the server-selected slot id into the final wheel rotation, so the pointer always stops on the slot that was paid out. The animation never picks a prize.

## Tests

```bash
npm test
```

Vitest covers the configuration validation, the weighted selection algorithm, the observed prize distribution against the theoretical one, the final-rotation geometry, and the spin service.
