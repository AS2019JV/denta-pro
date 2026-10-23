// A SQL date is a calendar day, not an instant. Keep its fields independent of UTC offsets.
function calendarBirthDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
    ? { year, month, day } : null
}

export function formatBirthDate(value) {
  const birth = calendarBirthDate(value)
  return birth ? `${birth.day}/${birth.month}/${birth.year}` : ''
}

