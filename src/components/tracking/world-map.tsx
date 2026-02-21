'use client'

import { useState, useCallback, useRef } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps'
import { locations, type TrackingLocation } from '@/data/tracking-locations'
import { MapMarker } from './map-marker'
import { MapTooltip } from './map-tooltip'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

export function WorldMap() {
  const [hoveredLocation, setHoveredLocation] = useState<TrackingLocation | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const handleMarkerHover = useCallback((location: TrackingLocation, event: React.MouseEvent) => {
    const rect = (event.currentTarget as SVGElement).closest('svg')?.getBoundingClientRect()
    if (rect) {
      setTooltipPos({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
    }
    setHoveredLocation(location)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[2/1] md:aspect-[2.5/1] overflow-hidden rounded-xl border border-border/30"
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 140,
          center: [10, 20],
        }}
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="hsl(240 5% 12%)"
                stroke="hsl(240 5% 18%)"
                strokeWidth={0.5}
                style={{
                  default: { outline: 'none' },
                  hover: { fill: 'hsl(240 5% 16%)', outline: 'none' },
                  pressed: { outline: 'none' },
                }}
              />
            ))
          }
        </Geographies>

        {locations.map((location, index) => (
          <Marker key={location.id} coordinates={location.coordinates}>
            <MapMarker
              cx={0}
              cy={0}
              color={location.color}
              index={index}
              onHover={(e) => handleMarkerHover(location, e)}
              onLeave={() => setHoveredLocation(null)}
            />
          </Marker>
        ))}
      </ComposableMap>

      {hoveredLocation && (
        <MapTooltip
          city={hoveredLocation.city}
          country={hoveredLocation.country}
          users={hoveredLocation.users}
          x={tooltipPos.x}
          y={tooltipPos.y}
          visible={true}
        />
      )}
    </div>
  )
}
