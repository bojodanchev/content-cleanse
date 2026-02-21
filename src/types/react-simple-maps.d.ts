declare module 'react-simple-maps' {
  import { ComponentType, CSSProperties, ReactNode } from 'react'

  interface ProjectionConfig {
    scale?: number
    center?: [number, number]
    rotate?: [number, number, number]
  }

  interface ComposableMapProps {
    projection?: string
    projectionConfig?: ProjectionConfig
    width?: number
    height?: number
    className?: string
    style?: CSSProperties
    children?: ReactNode
  }

  interface GeographiesProps {
    geography: string | object
    children: (data: { geographies: Geography[] }) => ReactNode
  }

  interface Geography {
    rsmKey: string
    [key: string]: unknown
  }

  interface GeographyProps {
    geography: Geography
    key?: string
    fill?: string
    stroke?: string
    strokeWidth?: number
    style?: {
      default?: CSSProperties
      hover?: CSSProperties
      pressed?: CSSProperties
    }
    onMouseEnter?: (event: React.MouseEvent) => void
    onMouseLeave?: (event: React.MouseEvent) => void
    [key: string]: unknown
  }

  interface MarkerProps {
    coordinates: [number, number]
    key?: string
    children?: ReactNode
    [key: string]: unknown
  }

  export const ComposableMap: ComponentType<ComposableMapProps>
  export const Geographies: ComponentType<GeographiesProps>
  export const Geography: ComponentType<GeographyProps>
  export const Marker: ComponentType<MarkerProps>
}
