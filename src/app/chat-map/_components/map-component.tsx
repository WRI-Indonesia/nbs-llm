'use client'

import { useEffect, useRef } from 'react'
import Map from 'ol/Map'

interface MapComponentProps {
  map: Map | null
}

export function MapComponent({ map }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (map && mapRef.current) {
      map.setTarget(mapRef.current)
    }
  }, [map])

  return (
    <div
      ref={mapRef}
      id="map"
      className="w-full h-full"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
      }}
    />
  )
}
