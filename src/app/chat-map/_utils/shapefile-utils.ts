'use client'

import JSZip from 'jszip'
import { Feature, FeatureCollection } from 'geojson'
import VectorSource from 'ol/source/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import { toast } from 'sonner'

export interface ShapefileData {
  features: Feature[]
  name: string
}

/**
 * Minimal SHP/SHX/DBF reader for basic geometries (Point, Polyline, Polygon).
 * Notes:
 * - SHX index offsets are big-endian 16-bit words (we multiply by 2 to get bytes).
 * - SHP record content is little-endian; record header (first 8 bytes) is big-endian.
 */
class ShapefileParser {
  private shpData: ArrayBuffer
  private shxData: ArrayBuffer
  private dbfData: ArrayBuffer

  constructor(shpData: ArrayBuffer, shxData: ArrayBuffer, dbfData: ArrayBuffer) {
    this.shpData = shpData
    this.shxData = shxData
    this.dbfData = dbfData
  }

  async parse(): Promise<FeatureCollection> {
    const features: Feature[] = []
    try {
      const offsets = this.parseShapefileIndex()
      for (const recordOffset of offsets) {
        const feature = this.parseShapeRecord(recordOffset)
        if (feature) features.push(feature)
      }
      return { type: 'FeatureCollection', features }
    } catch (error) {
      console.error('Error parsing shapefile:', error)
      throw error
    }
  }

  /** Parse .shx (big-endian) to list of byte offsets into .shp */
  private parseShapefileIndex(): number[] {
    const view = new DataView(this.shxData)
    const offsets: number[] = []
    let offset = 100 // skip header

    while (offset + 8 <= this.shxData.byteLength) {
      // 4 bytes offset (BE, in 16-bit words)
      const recordOffset16 = view.getInt32(offset, false)
      const recordOffsetBytes = recordOffset16 * 2
      offsets.push(recordOffsetBytes)
      offset += 8 // skip length as well; we don't need it for now
    }
    return offsets
  }

  /** Parse a single SHP record: header (8 bytes, BE) + content (LE) */
  private parseShapeRecord(recordOffset: number): Feature | null {
    try {
      const view = new DataView(this.shpData)

      // Content starts after 8-byte record header
      const contentOffset = recordOffset + 8

      // Shape type is LE int32
      const shapeType = view.getInt32(contentOffset, true)

      switch (shapeType) {
        case 0: // Null shape
          return null
        case 1: // Point
          return this.parsePoint(view, contentOffset + 4)
        case 3: // Polyline
          return this.parsePolyline(view, contentOffset + 4)
        case 5: // Polygon
          return this.parsePolygon(view, contentOffset + 4)
        default:
          console.warn(`Unsupported shape type: ${shapeType}`)
          return null
      }
    } catch (error) {
      console.error('Error parsing shape record:', error)
      return null
    }
  }

  private parsePoint(view: DataView, offset: number): Feature {
    const x = view.getFloat64(offset, true)
    const y = view.getFloat64(offset + 8, true)
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [x, y] },
      properties: {},
    }
  }

  private parsePolyline(view: DataView, offset: number): Feature {
    // bbox (32 bytes) -> numParts, numPoints
    const numParts = view.getInt32(offset + 32, true)
    const numPoints = view.getInt32(offset + 36, true)

    // part indices
    const parts: number[] = []
    for (let i = 0; i < numParts; i++) {
      parts.push(view.getInt32(offset + 40 + i * 4, true))
    }

    // points
    const points: number[][] = []
    const pointsOffset = offset + 40 + numParts * 4
    for (let i = 0; i < numPoints; i++) {
      const x = view.getFloat64(pointsOffset + i * 16, true)
      const y = view.getFloat64(pointsOffset + i * 16 + 8, true)
      points.push([x, y])
    }

    // build MultiLineString
    const coordinates: number[][][] = []
    for (let i = 0; i < parts.length; i++) {
      const start = parts[i]
      const end = i < parts.length - 1 ? parts[i + 1] : numPoints
      coordinates.push(points.slice(start, end))
    }

    return {
      type: 'Feature',
      geometry: { type: 'MultiLineString', coordinates },
      properties: {},
    }
  }

  private parsePolygon(view: DataView, offset: number): Feature {
    // bbox (32 bytes) -> numParts, numPoints
    const numParts = view.getInt32(offset + 32, true)
    const numPoints = view.getInt32(offset + 36, true)

    // part indices
    const parts: number[] = []
    for (let i = 0; i < numParts; i++) {
      parts.push(view.getInt32(offset + 40 + i * 4, true))
    }

    // points
    const points: number[][] = []
    const pointsOffset = offset + 40 + numParts * 4
    for (let i = 0; i < numPoints; i++) {
      const x = view.getFloat64(pointsOffset + i * 16, true)
      const y = view.getFloat64(pointsOffset + i * 16 + 8, true)
      points.push([x, y])
    }

    // NOTE: This naïvely turns each part into its own ring-wrapped polygon.
    // Proper ring classification (outer/inner) is out of scope for this minimal parser.
    const coordinates: number[][][][] = []
    for (let i = 0; i < parts.length; i++) {
      const start = parts[i]
      const end = i < parts.length - 1 ? parts[i + 1] : numPoints
      coordinates.push([points.slice(start, end)])
    }

    return {
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates },
      properties: {},
    }
  }
}

/** Load a ZIP of shapefiles, robust to filename casing (.SHP/.shp etc.) */
export async function processZipFile(file: File): Promise<ShapefileData[]> {
  try {
    // Validate file size (optional: add reasonable limits)
    if (file.size === 0) {
      throw new Error('The uploaded file is empty. Please select a valid ZIP file.')
    }

    const zip = new JSZip()
    let zipContent
    try {
      zipContent = await zip.loadAsync(file)
    } catch (zipError) {
      throw new Error('Invalid or corrupted ZIP file. Please ensure the file is a valid ZIP archive.')
    }

    const allNames = Object.keys(zipContent.files)
    const lower = new Map(allNames.map(n => [n.toLowerCase(), n]))

    const shpFiles = allNames.filter(n => n.toLowerCase().endsWith('.shp'))
    if (shpFiles.length === 0) {
      throw new Error('No shapefiles (.shp files) found in the ZIP file. Please ensure your ZIP contains valid shapefile components.')
    }

    const out: ShapefileData[] = []
    const errors: string[] = []

    for (const shpFile of shpFiles) {
      const baseLower = shpFile.toLowerCase().slice(0, -4) // drop ".shp"
      const shpName = lower.get(`${baseLower}.shp`)!
      const shxName = lower.get(`${baseLower}.shx`)
      const dbfName = lower.get(`${baseLower}.dbf`)

      if (!shxName || !dbfName) {
        const errorMsg = `Missing required files (.shx or .dbf) for ${shpFile}. Each shapefile needs .shp, .shx, and .dbf files.`
        console.warn(errorMsg)
        errors.push(errorMsg)
        continue
      }

      try {
        const shpData = await zipContent.files[shpName].async('arraybuffer')
        const shxData = await zipContent.files[shxName].async('arraybuffer')
        const dbfData = await zipContent.files[dbfName].async('arraybuffer')

        const parser = new ShapefileParser(shpData, shxData, dbfData)
        const geojson = await parser.parse()

        if (geojson?.features?.length) {
          out.push({ features: geojson.features, name: shpFile.replace(/\.shp$/i, '') })
        } else {
          console.warn(`No features found in ${shpFile}`)
        }
      } catch (err) {
        const errorMsg = `Failed to process ${shpFile}: ${err instanceof Error ? err.message : 'Unknown error'}`
        errors.push(errorMsg)
      }
    }

    if (!out.length) {
      const errorMessage = errors.length > 0 
        ? `No valid shapefiles could be processed. Errors: ${errors.join('; ')}`
        : 'No valid shapefiles could be processed from the ZIP file.'
      throw new Error(errorMessage)
    }

    // Show warnings for any files that couldn't be processed
    if (errors.length > 0) {
      console.warn('Some shapefiles could not be processed:', errors)
    }

    return out
  } catch (error) {
    if (error instanceof Error) {
      throw error
    } else {
      throw new Error('Failed to process the ZIP file. Please ensure it contains valid shapefiles.')
    }
  }
}

/** Add all features (as a FeatureCollection) to an OpenLayers VectorSource */
export function addShapefileToMap(vectorSource: VectorSource, shapefileData: ShapefileData): void {
  try {
    if (!shapefileData.features || shapefileData.features.length === 0) {
      console.warn(`No features to add for ${shapefileData.name}`)
      return
    }

    const format = new GeoJSON()
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: shapefileData.features,
    }

    const olFeatures = format.readFeatures(fc, {
      dataProjection: 'EPSG:4326',    // WGS84
      featureProjection: 'EPSG:3857', // Web Mercator (default OL view)
    })

    if (!olFeatures || olFeatures.length === 0) {
      console.warn(`No valid features could be converted for ${shapefileData.name}`)
      return
    }

    vectorSource.addFeatures(olFeatures)

    toast.success(`Added ${olFeatures.length} features from ${shapefileData.name}`)
  } catch (error) {
    const errorMessage = `Failed to add ${shapefileData.name} to map: ${error instanceof Error ? error.message : 'Unknown error'}`
    toast.error(errorMessage)
    throw new Error(errorMessage)
  }
}

