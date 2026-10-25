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

// Keep calendar birth dates separate from UTC instants when calculating age.
export function ageFromBirthDate(value, today = new Date()) {
  const birth = calendarBirthDate(value)
  if (!birth || !(today instanceof Date) || !Number.isFinite(today.getTime())) return null
  const year = today.getFullYear(), month = today.getMonth() + 1, day = today.getDate()
  let age = year - birth.year
  if (month < birth.month || (month === birth.month && day < birth.day)) age--
  return age < 0 ? null : age
}
