export interface TrackingLocation {
  id: string
  city: string
  country: string
  coordinates: [number, number] // [longitude, latitude]
  users: number
  color: 'primary' | 'accent'
}

export const locations: TrackingLocation[] = [
  // North America
  { id: 'new-york', city: 'New York', country: 'United States', coordinates: [-74.006, 40.7128], users: 8, color: 'primary' },
  { id: 'los-angeles', city: 'Los Angeles', country: 'United States', coordinates: [-118.2437, 34.0522], users: 6, color: 'primary' },
  { id: 'miami', city: 'Miami', country: 'United States', coordinates: [-80.1918, 25.7617], users: 4, color: 'accent' },
  { id: 'toronto', city: 'Toronto', country: 'Canada', coordinates: [-79.3832, 43.6532], users: 3, color: 'primary' },

  // Europe
  { id: 'london', city: 'London', country: 'United Kingdom', coordinates: [-0.1276, 51.5074], users: 6, color: 'primary' },
  { id: 'berlin', city: 'Berlin', country: 'Germany', coordinates: [13.405, 52.52], users: 3, color: 'accent' },

  // Asia-Pacific
  { id: 'dubai', city: 'Dubai', country: 'United Arab Emirates', coordinates: [55.2708, 25.2048], users: 4, color: 'primary' },
  { id: 'sydney', city: 'Sydney', country: 'Australia', coordinates: [151.2093, -33.8688], users: 2, color: 'accent' },

  // Latin America
  { id: 'sao-paulo', city: 'São Paulo', country: 'Brazil', coordinates: [-46.6333, -23.5505], users: 1, color: 'primary' },
]

export const totalUsers = locations.reduce((sum, l) => sum + l.users, 0)
export const totalCountries = new Set(locations.map(l => l.country)).size
export const totalCities = locations.length
export const uptimePercent = 99.97
