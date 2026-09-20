# Coven app

The [Coven](https://coven.network) web app. Swap and bridge on Arc, in one card, on a black screen.

Built with Next.js 16, React 19, Tailwind 4, wagmi 3 and [`@covennetwork/sdk`](https://www.npmjs.com/package/@covennetwork/sdk).

## Run it

```sh
npm install
cp .env.example .env.local
npm run dev
```

The app works without any environment variables, but a WalletConnect project ID is needed for the QR option, and a private Arc RPC URL is worth setting before real traffic.

| Variable | Use |
| --- | --- |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Enables the WalletConnect connector. Get one at cloud.reown.com |
| `NEXT_PUBLIC_ARC_RPC_URL` | Arc RPC endpoint. Defaults to the public one, which rate-limits heavy use |
| `NEXT_PUBLIC_INTEGRATOR_ADDRESS` | Address that receives an integrator fee, if you want one |
| `NEXT_PUBLIC_INTEGRATOR_FEE_BPS` | That fee in basis points, up to 300 |

## How it's built

Everything happens in one card at the center of the screen, and each step replaces the last one. There are no modals, no images and no color beyond black and white.

The main view is a sentence: "Pay 250 USDC · Base, get 216.34 ARGUS". Both sides are tappable, the amount is typed in place, and the outcome sits where the result belongs.

Bridging and new pairs are not separate screens. USDC on other chains appears in the asset list as `USDC · Base`, so picking it as what you pay with is a deposit, and picking it as what you receive is a withdrawal. The headline counts known assets and ticks upward as discovery finds more.

- `app/page.tsx` holds the flow: connect, WalletConnect, network, the sentence, the asset picker, review, status and account.
- `hooks/useAssets.ts` merges tokens, balances on Arc and USDC balances on the other chains, and tracks newly discovered ones.
- `hooks/useFlow.ts` runs swaps, withdrawals and deposits as a list of steps. A deposit carries on through delivery into the swap on Arc, and saves enough state to resume if the tab closes.
- `components/Ui.tsx` has the pieces every view is made of: label, title, slot, action, nav and note.
- `components/AssetPicker.tsx` pairs the wheel with details for whatever is selected: network, balance, decimals and the full contract address.
- `components/OptionWheel.tsx` and `components/CountUp.tsx` come from [React Bits](https://reactbits.dev).
- `components/Qr.tsx` draws the WalletConnect QR as rounded dots. On phones the app opens the wallet directly instead, since a QR is useless there.
- `components/Footer.tsx` holds the placeholder mark, the open source line, the GitHub link and the contact address. Swap the `Logo` SVG for your own and nothing else changes.

Motion is short and eased, and respects `prefers-reduced-motion`.

## Notes

- Gas on Arc is paid in USDC, so the Max button leaves 0.5 USDC behind.
- Any pair can trade. Routes hop through USDC or EURC when no direct pool exists, so neither side has to be USDC.
- Tokens that mimic USDC, EURC or USYC are marked in the token wheel.
- The new pairs list is live, built from pools created in the last few minutes.
