'use client'

import { useState, useEffect } from 'react'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { fromLonLat } from 'ol/proj'
import { Style, Stroke, Fill } from 'ol/style'
import { ChatSidebar } from './_components/chat-sidebar'
import { MapComponent } from './_components/map-component'
import { processZipFile, addShapefileToMap, ShapefileData } from './_utils/shapefile-utils'

export default function ChatMapPage() {
  const [map, setMap] = useState<Map | null>(null)
  const [vectorSource, setVectorSource] = useState<VectorSource | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const vectorSrc = new VectorSource()
    const vectorLayer = new VectorLayer({
      source: vectorSrc,
      style: new Style({
        stroke: new Stroke({
          color: '#3388ff',
          width: 2,
        }),
        fill: new Fill({
          color: 'rgba(51, 136, 255, 0.1)',
        }),
      }),
    })

    const mapInstance = new Map({
      target: 'map', // MapComponent will re-attach to its ref
      layers: [
        new TileLayer({ source: new OSM() }),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2,
      }),
    })

    setMap(mapInstance)
    setVectorSource(vectorSrc)

    return () => {
      mapInstance.setTarget(undefined)
    }
  }, [])

  const fitToData = (m: Map, src: VectorSource) => {
    const features = src.getFeatures()
    if (!features.length) return
    const extent = src.getExtent()
    const isValid = extent.every(n => Number.isFinite(n))
    if (!isValid) return
    m.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 16 })
  }

  const handleFileUpload = async (file: File): Promise<void> => {
    if (!vectorSource) {
      throw new Error('Map is not ready. Please try again.')
    }
    
    setIsLoading(true)
    try {
      const shapefileData: ShapefileData[] = await processZipFile(file)

      if (!shapefileData || shapefileData.length === 0) {
        throw new Error('No valid shapefiles found in the ZIP file')
      }

      // Add each shapefile to the map
      for (const data of shapefileData) {
        try {
          addShapefileToMap(vectorSource, data)
        } catch (error) {
          // Continue processing other shapefiles even if one fails
        }
      }

      // Fit the map view to show all features
      if (map) fitToData(map, vectorSource)
    } catch (error) {
      // Re-throw the error so it can be handled by the ChatSidebar
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen pt-14">
      {/* Chat Sidebar */}
      <div className="w-[400px] bg-white border-r border-gray-200 flex flex-col">
        <ChatSidebar onFileUpload={handleFileUpload} isLoading={isLoading} />
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <MapComponent map={map} />
      </div>
    </div>
  )
}
