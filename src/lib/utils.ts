function getVideoCode(s: string): string | null {
  return s.match(/[a-zA-Z]+-\d+/)?.[0] ?? s.match(/[a-zA-Z]+\d+/)?.[0] ?? null
}

export function fixTitle(title: string): string {
  const fixSymbol = title.replace(/&#(\d+);/g, function (_match, dec) {
    const point = Number(dec)
    return point <= 0x10ffff ? String.fromCodePoint(point) : _match
  })

  const videoCode = getVideoCode(title)
  if (!videoCode) {
    return fixSymbol.trim()
  }

  return fixSymbol.replaceAll(videoCode, '').trim()
}

export function reverseName(name: string): string {
  return name.split(' ').reverse().join(' ')
}

export function formatDurationToMinutes(durationStr: string): number {
  if (!/^\d+:\d{2}(?::\d{2})?$/.test(durationStr)) return 0
  const parts = durationStr.split(':')
  if (parts.slice(1).some(part => Number(part) >= 60)) return 0
  let minutes = 0

  if (parts.length === 3) {
    minutes += parseInt(parts[0], 10) * 60
    minutes += parseInt(parts[1], 10)
    minutes += parseInt(parts[2], 10) / 60
  } else if (parts.length === 2) {
    minutes += parseInt(parts[0], 10)
    minutes += parseInt(parts[1], 10) / 60
  }

  return Math.round(minutes)
}

export function toDurationFormat(value: number): string {
  value = Number.isFinite(value) && value > 0 ? Math.round(value) : 0
  const hour: number = Math.floor(value / 60)
  const minute: number = value % 60
  return `${hour} hrs ${minute} min`
}

export function toDateFormat(dateString: string): string | null {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return null
  return Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric' as const,
  }).format(date)
}

export function maxWords(str: string, n: number): string {
  const words = str.split(' ')
  if (words.length <= n) {
    return str
  }
  return words.slice(0, n).join(' ') + '...'
}
