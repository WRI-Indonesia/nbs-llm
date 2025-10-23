import { PrismaClient } from "@prisma/client"

// Create a separate Prisma client for the geo database
// This assumes the geo data is in a different database or schema
export const geoPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.GEO_DATABASE_URL || process.env.DATABASE_URL
    }
  }
})

// Type definitions for geo location data
export interface GeoLocation {
  id: number
  province: string
  district: string
  subdistrict: string
  village: string
  geometry?: string
  metadata_id?: number
}

export interface GeoSearchResult {
  district: string
  province: string
}
