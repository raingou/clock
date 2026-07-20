export type HolidayCountry = 'VN' | 'KH'

export interface PublicHoliday {
  date: string
  name: string
  countryCode: HolidayCountry
  nationalHoliday?: boolean
  holidayTypes?: string[]
}

const memoryCache = new Map<string, PublicHoliday[]>()

export async function getPublicHolidays(country: HolidayCountry, year: number): Promise<PublicHoliday[]> {
  const cacheKey = `public-holidays-v1-${country}-${year}`
  if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey)!

  try {
    const stored = localStorage.getItem(cacheKey)
    if (stored) {
      const parsed = JSON.parse(stored) as PublicHoliday[]
      memoryCache.set(cacheKey, parsed)
      return parsed
    }
  }
  catch {
    // Ignore unavailable or invalid browser cache.
  }

  const response = await fetch(`https://date.nager.at/api/v4/Holidays/${country}/${year}`)
  if (!response.ok) throw new Error(`Holiday API returned ${response.status}`)

  const data = await response.json() as PublicHoliday[]
  const holidays = data.filter(item => item.nationalHoliday !== false && (!item.holidayTypes || item.holidayTypes.includes('Public')))
  memoryCache.set(cacheKey, holidays)

  try {
    localStorage.setItem(cacheKey, JSON.stringify(holidays))
  }
  catch {
    // The calendar still works when browser storage is unavailable.
  }

  return holidays
}
