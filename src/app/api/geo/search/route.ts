import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import * as shapefile from 'shapefile';

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs';

type HitRow = { province: string | null; district: string | null };

// --- ZIP helpers -------------------------------------------------------------

async function readZipToMap(zipBuf: Buffer) {
  const zip = await JSZip.loadAsync(zipBuf);
  const map: Record<string, Buffer> = {};
  const names = Object.keys(zip.files);
  for (const name of names) {
    const file = zip.files[name];
    if (file.dir) continue;
    const buf = await file.async('nodebuffer');
    map[name.toLowerCase()] = buf;
  }
  return map;
}

function findShapefileStem(entries: Record<string, Buffer>) {
  const shp = Object.keys(entries).find((n) => n.endsWith('.shp'));
  if (!shp) return null;
  const base = shp.replace(/\.shp$/, '');
  const dbf = `${base}.dbf`;
  return { shp, dbf: entries[dbf] ? dbf : undefined };
}

// --- Geometry extraction -----------------------------------------------------

async function readGeometriesFromShapefile(
  shpBuf: Buffer,
  dbfBuf?: Buffer
): Promise<GeoJSON.Geometry[]> {
  const shpAb = shpBuf.buffer.slice(shpBuf.byteOffset, shpBuf.byteOffset + shpBuf.byteLength);
  const dbfAb =
    dbfBuf && dbfBuf.byteLength > 0
      ? dbfBuf.buffer.slice(dbfBuf.byteOffset, dbfBuf.byteOffset + dbfBuf.byteLength)
      : undefined;

  const source = await shapefile.open(shpAb as ArrayBuffer, dbfAb as ArrayBuffer | undefined);
  const geoms: GeoJSON.Geometry[] = [];
  while (true) {
    const result = await source.read();
    if (result.done) break;
    if (result.value?.geometry) geoms.push(result.value.geometry as GeoJSON.Geometry);
  }
  return geoms;
}

async function extractGeometriesFromZip(zipBuf: Buffer): Promise<GeoJSON.Geometry[]> {
  const entries = await readZipToMap(zipBuf);

  // Prefer GeoJSON if present
  const gj = Object.keys(entries).find((n) => n.endsWith('.geojson') || n.endsWith('.json'));
  if (gj) {
    const parsed = JSON.parse(entries[gj].toString('utf8'));
    if (parsed.type === 'FeatureCollection') {
      return (parsed.features ?? []).map((f: any) => f?.geometry).filter(Boolean);
    }
    if (parsed.type === 'Feature' && parsed.geometry) return [parsed.geometry];
    if (parsed.type && parsed.coordinates) return [parsed as GeoJSON.Geometry];
    throw new Error('GeoJSON found but no valid geometries.');
  }

  // Otherwise, fall back to Shapefile
  const stem = findShapefileStem(entries);
  if (!stem) throw new Error('ZIP does not contain a .shp (or .geojson) file.');
  return readGeometriesFromShapefile(entries[stem.shp], stem.dbf ? entries[stem.dbf] : undefined);
}

// --- SQL builder (single param: GeometryCollection) --------------------------

function buildSqlForGeometryCollection(geoms: GeoJSON.Geometry[]) {
  // Always reproject to EPSG:4326 before intersecting (DB-side).
  // Use a single parameter (GeometryCollection) to avoid hitting parameter limits.
  const geomCollection = {
    type: 'GeometryCollection',
    geometries: geoms,
  };
  const sql = `
    SELECT DISTINCT province, district
    FROM administrative_boundaries
    WHERE ST_Intersects(
      geometry,  -- assumed stored in EPSG:4326
      ST_Transform(
        ST_UnaryUnion(
          ST_SetSRID(
            ST_GeomFromGeoJSON($1),
            4326
          )
        ),
        4326
      )
    );
  `;
  const params = [JSON.stringify(geomCollection)];
  return { sql, params };
}

// --- Route -------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: 'Missing file (field "file")' }, { status: 400 });
    }

    const isZip = file.type === 'application/zip' || file.name.toLowerCase().endsWith('.zip');
    if (!isZip) {
      return NextResponse.json({ success: false, error: 'Please upload a .zip file' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());

    // 1) Extract geometries from ZIP (GeoJSON or Shapefile)
    const geoms = await extractGeometriesFromZip(buf);
    if (!geoms.length) {
      return NextResponse.json({ success: true, count: 0, data: [] }, { status: 200 });
    }

    // 2) Build SQL (single JSON param)
    const { sql, params } = buildSqlForGeometryCollection(geoms);

    // 3) Query with geo prisma (lazy)
    const mod = await import('@/lib/geo-prisma')
    const geoPrisma = typeof (mod as any).getGeoPrisma === 'function' ? (mod as any).getGeoPrisma() : (mod as any).geoPrisma
    const rows = await (geoPrisma as any).$queryRawUnsafe(sql, ...params) as HitRow[];

    const data = rows.map((r) => ({
      district: r.district ?? '',
      province: r.province ?? '',
    }));

    return NextResponse.json({ success: true, count: data.length, data }, { status: 200 });
  } catch (err: any) {
    console.error('[/api/geo/search] error:', err);
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Failed to search geo locations' },
      { status: 500 }
    );
  }
}
