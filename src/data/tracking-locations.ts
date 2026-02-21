export interface TrackingLocation {
  id: string
  city: string
  country: string
  coordinates: [number, number] // [longitude, latitude]
  users: number
  color: 'primary' | 'accent'
}

export const locations: TrackingLocation[] = [
  // North America — strongest early market
  { id: 'new-york', city: 'New York', country: 'United States', coordinates: [-74.006, 40.7128], users: 64, color: 'primary' },
  { id: 'los-angeles', city: 'Los Angeles', country: 'United States', coordinates: [-118.2437, 34.0522], users: 47, color: 'primary' },
  { id: 'miami', city: 'Miami', country: 'United States', coordinates: [-80.1918, 25.7617], users: 31, color: 'accent' },
  { id: 'toronto', city: 'Toronto', country: 'Canada', coordinates: [-79.3832, 43.6532], users: 22, color: 'primary' },

  // Europe — early adopters
  { id: 'london', city: 'London', country: 'United Kingdom', coordinates: [-0.1276, 51.5074], users: 53, color: 'primary' },
  { id: 'berlin', city: 'Berlin', country: 'Germany', coordinates: [13.405, 52.52], users: 28, color: 'accent' },
  { id: 'amsterdam', city: 'Amsterdam', country: 'Netherlands', coordinates: [4.9041, 52.3676], users: 19, color: 'accent' },

  // Asia-Pacific — emerging
  { id: 'dubai', city: 'Dubai', country: 'United Arab Emirates', coordinates: [55.2708, 25.2048], users: 36, color: 'primary' },
  { id: 'singapore', city: 'Singapore', country: 'Singapore', coordinates: [103.8198, 1.3521], users: 18, color: 'accent' },
  { id: 'sydney', city: 'Sydney', country: 'Australia', coordinates: [151.2093, -33.8688], users: 24, color: 'accent' },

  // Latin America — first sign-ups
  { id: 'sao-paulo', city: 'São Paulo', country: 'Brazil', coordinates: [-46.6333, -23.5505], users: 21, color: 'primary' },
  { id: 'mexico-city', city: 'Mexico City', country: 'Mexico', coordinates: [-99.1332, 19.4326], users: 14, color: 'primary' },
]

export const totalUsers = locations.reduce((sum, l) => sum + l.users, 0)
export const totalCountries = new Set(locations.map(l => l.country)).size
export const totalCities = locations.length
export const uptimePercent = 99.97
