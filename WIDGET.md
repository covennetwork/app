# Coven Swap Widget

Embed the Coven swap experience on any site. Users connect their own wallet and swap on Arc
without leaving your page. You can lock the widget to a specific pool, and earn an integrator
fee on every swap.

The widget is the same UI as the main Coven app, served from `/widget` and rendered inside an
iframe so its wallet connection stays isolated from your page.

## Quick start (any site)

Drop one script tag where you want the widget to appear:

```html
<script
  src="https://coven.network/embed.js"
  data-integrator="0xYourFeeAddress"
  data-integrator-fee="30"
></script>
```

That renders an open widget: the user picks any Arc pair and swaps. The iframe auto-sizes to its
content — no scrollbars, no fixed height to guess.

## Lock it to one pool

A locked widget fixes the pay/receive tokens to a pool's two tokens (the user only chooses
direction and amount) and routes the swap through that pool. There are two ways to point at one.

### By pool identifier (simplest)

Pass a single `data-pool` and the widget resolves the pair itself:

```html
<script
  src="https://coven.network/embed.js"
  data-integrator="0xYourFeeAddress"
  data-integrator-fee="30"
  data-pool="0xYourPoolAddressOrId"
></script>
```

- For a **v3 pool** that's the pool **contract address** — its tokens are read straight off it.
- For a **v4 pool** that's the pool **id** (the hash of its key). A v4 id can't be reversed to
  its tokens, so the widget resolves it through pool discovery; the id must belong to a pool
  Coven has discovered. This resolves the full pool key too, so the swap routes through exactly
  that pool.

### By explicit tokens (no lookup)

If you already know the pair, spell it out — nothing is resolved at runtime:

```html
<script
  src="https://coven.network/embed.js"
  data-integrator="0xYourFeeAddress"
  data-integrator-fee="30"
  data-token0="0xUSDCaddress"
  data-token1="0xYourTokenAddress"
  data-pool-fee="3000"
  data-tick-spacing="60"
  data-hooks="0x0000000000000000000000000000000000000000"
></script>
```

- `data-token0` / `data-token1` — the two tokens (pay = token0, receive = token1; the user can
  flip). Providing these alone locks the pair.
- `data-pool-fee`, `data-tick-spacing`, `data-hooks` — the full pool key. Provide **all three**
  and the router is told to use exactly that pool (passed as `extraPools`). Omit them and the
  pair is still locked, but routing falls back to whatever pools the router already knows.

`data-token0`/`data-token1` take priority over `data-pool` when both are present.

## Options

| Script attribute      | Widget param     | Meaning                                                        |
| --------------------- | ---------------- | -------------------------------------------------------------- |
| `data-integrator`     | `integrator`     | Address that receives the integrator fee.                      |
| `data-integrator-fee` | `integratorFee`  | Integrator fee in basis points (capped by the router).         |
| `data-pool`           | `pool`           | Single pool identifier — v3 pool address or v4 pool id.        |
| `data-token0`         | `token0`         | Pool token the user pays with by default.                      |
| `data-token1`         | `token1`         | Pool token the user receives by default.                       |
| `data-pool-fee`       | `poolFee`        | Pool fee tier.                                                  |
| `data-tick-spacing`   | `tickSpacing`    | Pool tick spacing.                                              |
| `data-hooks`          | `hooks`          | Pool hooks address (`0x0…0` for none).                         |
| `data-slippage`       | `slippage`       | Max slippage in basis points (default `50`).                   |
| `data-bg`             | `bg`             | Background color (hex, or `transparent`). Default `#EFECE4`.    |
| `data-target`         | —                | CSS selector of the element to mount into (default: in place). |
| `data-width`          | —                | Max iframe width (default `460px`).                            |

## Direct iframe

If you'd rather not use the loader, point an iframe at `/widget` with the params above and listen
for the resize message yourself:

```html
<iframe
  src="https://coven.network/widget?integrator=0xYourFeeAddress&integratorFee=30&token0=0x…&token1=0x…&poolFee=3000&tickSpacing=60&hooks=0x0000000000000000000000000000000000000000"
  style="width: 100%; max-width: 460px; height: 520px; border: 0;"
  allow="clipboard-write; ethereum"
></iframe>
<script>
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'coven:resize') {
      /* set your iframe height to e.data.height */
    }
  })
</script>
```

## React

For React / Next hosts there is a package that manages the iframe and resizing for you,
[`@covennetwork/widget`](../widget):

```tsx
import { CovenSwapWidget } from '@covennetwork/widget'

;<CovenSwapWidget
  integrator="0xYourFeeAddress"
  integratorFee={30}
  pool="0xYourPoolAddressOrId"
/>
```

It depends only on React — the wallet connection, routing and SDK all run inside the iframe — so
it never clashes with your app's own wagmi/wallet setup.

## Notes

- The widget only swaps on Arc; if the user's wallet is on another network it prompts them to
  switch. Bridging between chains stays in the full Coven app.
- The integrator fee is validated against the router's cap; anything above it is clamped.
- `bg` only accepts a hex color or `transparent` — other values fall back to the brand color, so
  the widget can't be styled into something misleading.
