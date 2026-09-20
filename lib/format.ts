export function formatUnitsCompact(value: bigint, decimals: number, maxFractionDigits = 6): string {
  const negative = value < 0n
  const raw = (negative ? -value : value).toString().padStart(decimals + 1, '0')
  const whole = raw.slice(0, raw.length - decimals)
  const fraction = decimals === 0 ? '' : raw.slice(raw.length - decimals).replace(/0+$/, '').slice(0, maxFractionDigits)
  const wholeGrouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${wholeGrouped}${fraction ? `.${fraction}` : ''}`
}

export function parseAmount(input: string, decimals: number): bigint {
  if (!input || input === '.') return 0n
  const [whole = '0', fraction = ''] = input.split('.')
  const padded = (fraction + '0'.repeat(decimals)).slice(0, decimals)
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(padded || '0')
}

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`
