/**
 * Coven swap widget loader.
 *
 * Drop this on any page to embed the Coven swap widget in an auto-sizing iframe:
 *
 *   <script
 *     src="https://coven.network/embed.js"
 *     data-integrator="0xYourFeeAddress"
 *     data-integrator-fee="30"
 *     data-token0="0x...usdc"
 *     data-token1="0x...yourToken"
 *     data-pool-fee="3000"
 *     data-tick-spacing="60"
 *     data-hooks="0x0000000000000000000000000000000000000000"
 *     data-slippage="50"
 *     data-bg="#EFECE4"
 *   ></script>
 *
 * The iframe is inserted where the script tag sits, or into the element named by
 * `data-target` (a CSS selector). Omit the pool params for an open widget where the
 * user picks any Arc pair. See WIDGET.md for the full option list.
 */
;(function () {
  var script = document.currentScript
  if (!script) return

  // Origin the widget is served from — the same host this script was loaded from.
  var origin = new URL(script.src).origin

  // Map data-* attributes to widget query params. Anything absent is simply left off.
  var map = {
    'data-integrator': 'integrator',
    'data-integrator-fee': 'integratorFee',
    'data-pool': 'pool',
    'data-token0': 'token0',
    'data-token1': 'token1',
    'data-pool-fee': 'poolFee',
    'data-tick-spacing': 'tickSpacing',
    'data-hooks': 'hooks',
    'data-slippage': 'slippage',
    'data-bg': 'bg',
  }
  var params = new URLSearchParams()
  Object.keys(map).forEach(function (attr) {
    var value = script.getAttribute(attr)
    if (value !== null && value !== '') params.set(map[attr], value)
  })

  var iframe = document.createElement('iframe')
  iframe.src = origin + '/widget?' + params.toString()
  iframe.title = 'Coven swap'
  iframe.loading = 'lazy'
  // A wallet popup (WalletConnect deep link, injected provider) needs these to open.
  iframe.allow = 'clipboard-write; ethereum'
  iframe.style.width = '100%'
  iframe.style.maxWidth = script.getAttribute('data-width') || '460px'
  iframe.style.height = '520px'
  iframe.style.border = '0'
  iframe.style.colorScheme = 'normal'
  iframe.style.display = 'block'

  var target = script.getAttribute('data-target')
  var mount = target ? document.querySelector(target) : script.parentNode
  if (mount) mount.insertBefore(iframe, target ? null : script)

  // The widget reports its content height so the iframe never scrolls internally.
  window.addEventListener('message', function (event) {
    if (event.source !== iframe.contentWindow) return
    var data = event.data
    if (data && data.type === 'coven:resize' && typeof data.height === 'number') {
      iframe.style.height = Math.ceil(data.height) + 'px'
    }
  })
})()
