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
  { id: 'new-york', city: 'New York', country: 'United States', coordinates: [-74.006, 40.7128], users: 847, color: 'primary' },
  { id: 'los-angeles', city: 'Los Angeles', country: 'United States', coordinates: [-118.2437, 34.0522], users: 623, color: 'primary' },
  { id: 'miami', city: 'Miami', country: 'United States', coordinates: [-80.1918, 25.7617], users: 284, color: 'accent' },
  { id: 'toronto', city: 'Toronto', country: 'Canada', coordinates: [-79.3832, 43.6532], users: 391, color: 'primary' },
  { id: 'chicago', city: 'Chicago', country: 'United States', coordinates: [-87.6298, 41.8781], users: 312, color: 'accent' },
  { id: 'mexico-city', city: 'Mexico City', country: 'Mexico', coordinates: [-99.1332, 19.4326], users: 178, color: 'primary' },

  // Europe
  { id: 'london', city: 'London', country: 'United Kingdom', coordinates: [-0.1276, 51.5074], users: 756, color: 'primary' },
  { id: 'berlin', city: 'Berlin', country: 'Germany', coordinates: [13.405, 52.52], users: 445, color: 'accent' },
  { id: 'paris', city: 'Paris', country: 'France', coordinates: [2.3522, 48.8566], users: 534, color: 'primary' },
  { id: 'amsterdam', city: 'Amsterdam', country: 'Netherlands', coordinates: [4.9041, 52.3676], users: 267, color: 'primary' },
  { id: 'stockholm', city: 'Stockholm', country: 'Sweden', coordinates: [18.0686, 59.3293], users: 189, color: 'accent' },
  { id: 'madrid', city: 'Madrid', country: 'Spain', coordinates: [-3.7038, 40.4168], users: 321, color: 'primary' },

  // Asia
  { id: 'tokyo', city: 'Tokyo', country: 'Japan', coordinates: [139.6917, 35.6895], users: 698, color: 'primary' },
  { id: 'singapore', city: 'Singapore', country: 'Singapore', coordinates: [103.8198, 1.3521], users: 412, color: 'accent' },
  { id: 'dubai', city: 'Dubai', country: 'United Arab Emirates', coordinates: [55.2708, 25.2048], users: 356, color: 'primary' },
  { id: 'mumbai', city: 'Mumbai', country: 'India', coordinates: [72.8777, 19.076], users: 523, color: 'accent' },
  { id: 'seoul', city: 'Seoul', country: 'South Korea', coordinates: [126.978, 37.5665], users: 467, color: 'primary' },
  { id: 'bangkok', city: 'Bangkok', country: 'Thailand', coordinates: [100.5018, 13.7563], users: 234, color: 'accent' },

  // South America
  { id: 'sao-paulo', city: 'S\u00e3o Paulo', country: 'Brazil', coordinates: [-46.6333, -23.5505], users: 489, color: 'primary' },
  { id: 'buenos-aires', city: 'Buenos Aires', country: 'Argentina', coordinates: [-58.3816, -34.6037], users: 276, color: 'accent' },
  { id: 'bogota', city: 'Bogot\u00e1', country: 'Colombia', coordinates: [-74.0721, 4.711], users: 145, color: 'primary' },
  { id: 'lima', city: 'Lima', country: 'Peru', coordinates: [-77.0428, -12.0464], users: 98, color: 'accent' },

  // Africa
  { id: 'lagos', city: 'Lagos', country: 'Nigeria', coordinates: [3.3792, 6.5244], users: 167, color: 'primary' },
  { id: 'nairobi', city: 'Nairobi', country: 'Kenya', coordinates: [36.8219, -1.2921], users: 89, color: 'accent' },
  { id: 'cape-town', city: 'Cape Town', country: 'South Africa', coordinates: [18.4241, -33.9249], users: 134, color: 'primary' },
  { id: 'cairo', city: 'Cairo', country: 'Egypt', coordinates: [31.2357, 30.0444], users: 203, color: 'primary' },

  // Oceania
  { id: 'sydney', city: 'Sydney', country: 'Australia', coordinates: [151.2093, -33.8688], users: 378, color: 'accent' },
  { id: 'auckland', city: 'Auckland', country: 'New Zealand', coordinates: [174.7633, -36.8485], users: 12, color: 'primary' },
]

export const totalUsers = locations.reduce((sum, l) => sum + l.users, 0)
export const totalCountries = new Set(locations.map(l => l.country)).size
export const totalCities = locations.length
export const uptimePercent = 99.98
