import { describe, expect, test } from "vitest";
import { AerialImagery } from "@/lib/contracts";
import { buildBboxWkt, parseVexcelXmp, toAerialImagery } from "@/lib/data/vexcel";

const hasKey = Boolean(process.env.VEXCEL_API_KEY);
const describeLive = describe.skipIf(!hasKey);

const TRAVIS = { id: 1018657, lat: 29.74587, lon: -95.375417 };

/**
 * Real XMP field names and value FORMATS, captured from live responses on 2026-11-14; the
 * numbers are the real ones because the shape is the point. No image bytes are committed.
 *
 * Ortho and oblique carry different date fields, which is the whole reason this parser exists.
 */
const ORTHO_XMP = `<x:xmpmeta><rdf:RDF xmlns:rdf="x"><rdf:Description xmlns:Vexcel=""><Vexcel:geometry>POLYGON ((-95.376 29.745, -95.376 29.746, -95.374 29.746, -95.374 29.745, -95.376 29.745))</Vexcel:geometry><Vexcel:srid>4326</Vexcel:srid><Vexcel:product-type>spherical-ortho</Vexcel:product-type><Vexcel:first-capture-date>Fri Dec 19 16:38:26 UTC 2025</Vexcel:first-capture-date><Vexcel:last-capture-date>Fri Jan 02 18:43:55 UTC 2026</Vexcel:last-capture-date><Vexcel:min-gsd>0.07239386</Vexcel:min-gsd><Vexcel:max-gsd>0.078970134</Vexcel:max-gsd><Vexcel:collection>us-tx-houston-2026</Vexcel:collection><Vexcel:layer>urban</Vexcel:layer><Vexcel:camera-technology>UltraCam_Osprey_4.1_f120</Vexcel:camera-technology><Vexcel:pixel-bbox>126200430,221935657,1790,2062</Vexcel:pixel-bbox></rdf:Description></rdf:RDF></x:xmpmeta>`;

const OBLIQUE_XMP = `<x:xmpmeta><rdf:RDF xmlns:rdf="x"><rdf:Description xmlns:Vexcel=""><Vexcel:capture-date>2025-12-31 17:36:59.0</Vexcel:capture-date><Vexcel:collection>us-tx-houston-2026</Vexcel:collection><Vexcel:layer>urban</Vexcel:layer><Vexcel:min-gsd>0.061062854408153254</Vexcel:min-gsd><Vexcel:max-gsd>0.08320974192406135</Vexcel:max-gsd><Vexcel:product-type>oblique-north</Vexcel:product-type><Vexcel:pixel-bbox>4555,6896,1882,1756</Vexcel:pixel-bbox></rdf:Description></rdf:RDF></x:xmpmeta>`;

describe("buildBboxWkt", () => {
  test("builds a closed EPSG:4326 polygon around a point", () => {
    const wkt = buildBboxWkt(TRAVIS.lat, TRAVIS.lon, 80);
    expect(wkt).toMatch(/^POLYGON\(\(/);
    const coords = wkt.replace(/^POLYGON\(\(|\)\)$/g, "").split(",");
    expect(coords).toHaveLength(5);
    expect(coords[0].trim()).toBe(coords[4].trim()); // a ring must close
  });

  test("sizes the box in metres, widening longitude with latitude", () => {
    const equator = buildBboxWkt(0, 0, 100);
    const houston = buildBboxWkt(29.74587, -95.375417, 100);
    const lonSpan = (wkt: string) => {
      const pts = wkt.replace(/^POLYGON\(\(|\)\)$/g, "").split(",").map((p) => p.trim().split(" ").map(Number));
      return Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
    };
    // A degree of longitude is shorter away from the equator, so the same metres span more of it.
    expect(lonSpan(houston)).toBeGreaterThan(lonSpan(equator));
  });

  test("a POINT is never sent: extract rejects one with HTTP 400", () => {
    // Vexcel: "If 'wkt' is a point, it requires either 'bbox-dimensions', 'buffer-meter'…".
    expect(buildBboxWkt(TRAVIS.lat, TRAVIS.lon, 80)).not.toContain("POINT");
  });
});

describe("parseVexcelXmp", () => {
  test("reads an ortho packet, including both capture dates", () => {
    const xmp = parseVexcelXmp(ORTHO_XMP);
    expect(xmp).toMatchObject({
      collection: "us-tx-houston-2026",
      layer: "urban",
      productType: "spherical-ortho",
      minGsd: 0.07239386,
      maxGsd: 0.078970134,
      width: 1790,
      height: 2062,
      cameraTechnology: "UltraCam_Osprey_4.1_f120",
    });
    expect(xmp!.firstCaptureDate).toBe("2025-12-19T16:38:26.000Z");
    expect(xmp!.lastCaptureDate).toBe("2026-01-02T18:43:55.000Z");
  });

  test("reads an oblique packet, where a single capture-date stands for both ends", () => {
    const xmp = parseVexcelXmp(OBLIQUE_XMP);
    expect(xmp).toMatchObject({
      collection: "us-tx-houston-2026",
      productType: "oblique-north",
      width: 1882,
      height: 1756,
    });
    // Oblique has no first/last pair, so the one date is both ends rather than a fabricated range.
    expect(xmp!.firstCaptureDate).toBe("2025-12-31T17:36:59.000Z");
    expect(xmp!.lastCaptureDate).toBe("2025-12-31T17:36:59.000Z");
  });

  test("finds the packet inside JPEG bytes", () => {
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe1]),
      Buffer.from(ORTHO_XMP, "latin1"),
      Buffer.from([0xff, 0xd9]),
    ]);
    expect(parseVexcelXmp(jpeg)?.collection).toBe("us-tx-houston-2026");
  });

  test("returns null when there is no XMP packet at all", () => {
    expect(parseVexcelXmp(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
  });

  test("tolerates a packet missing dates and dimensions", () => {
    const sparse = `<x:xmpmeta><Vexcel:collection>c</Vexcel:collection><Vexcel:layer>urban</Vexcel:layer></x:xmpmeta>`;
    const xmp = parseVexcelXmp(sparse);
    expect(xmp).toMatchObject({ collection: "c", layer: "urban" });
    expect(xmp!.firstCaptureDate).toBeNull();
    expect(xmp!.width).toBeNull();
    expect(xmp!.minGsd).toBeNull();
  });
});

describe("toAerialImagery", () => {
  const wkt = buildBboxWkt(TRAVIS.lat, TRAVIS.lon, 80);

  test("produces a contract-valid record for an ortho image", () => {
    const imagery = toAerialImagery({
      propertyId: TRAVIS.id,
      kind: "ortho",
      direction: null,
      bboxWkt: wkt,
      xmp: parseVexcelXmp(ORTHO_XMP)!,
    });
    expect(() => AerialImagery.parse(imagery)).not.toThrow();
    expect(imagery).toMatchObject({
      provider: "vexcel",
      kind: "ortho",
      direction: null,
      collection: "us-tx-houston-2026",
      layer: "urban",
      gsdMeters: { min: 0.07239386, max: 0.078970134 },
      width: 1790,
      height: 2062,
      attribution: "© Vexcel Imaging US, Inc.",
    });
  });

  test("points imageUrl at our own proxy, never at Vexcel", () => {
    const imagery = toAerialImagery({
      propertyId: TRAVIS.id,
      kind: "oblique",
      direction: "north",
      bboxWkt: wkt,
      xmp: parseVexcelXmp(OBLIQUE_XMP)!,
    });
    expect(imagery.imageUrl).toBe("/api/imagery/vexcel/oblique?propertyId=1018657&direction=north");
    const serialized = JSON.stringify(imagery);
    expect(serialized).not.toContain("vexcelgroup.com");
    expect(serialized).not.toContain("x-api-key");
  });

  test("keeps the Vexcel attribution, which the licence requires", () => {
    const imagery = toAerialImagery({
      propertyId: TRAVIS.id,
      kind: "ortho",
      direction: null,
      bboxWkt: wkt,
      xmp: parseVexcelXmp(ORTHO_XMP)!,
    });
    expect(imagery.attribution).toContain("Vexcel");
  });

  test("records a SourceRef with the capture date, not just the fetch time", () => {
    const imagery = toAerialImagery({
      propertyId: TRAVIS.id,
      kind: "ortho",
      direction: null,
      bboxWkt: wkt,
      xmp: parseVexcelXmp(ORTHO_XMP)!,
    });
    expect(imagery.source).toMatchObject({
      system: "vexcel",
      dataset: "ortho/extract",
      recordId: "us-tx-houston-2026",
      capturedAt: "2025-12-19T16:38:26.000Z",
    });
  });

  test("falls back to an empty capture range when the packet has no dates", () => {
    const sparse = parseVexcelXmp(
      `<x:xmpmeta><Vexcel:collection>c</Vexcel:collection><Vexcel:layer>urban</Vexcel:layer></x:xmpmeta>`,
    )!;
    const imagery = toAerialImagery({
      propertyId: TRAVIS.id,
      kind: "ortho",
      direction: null,
      bboxWkt: wkt,
      xmp: sparse,
    });
    // The contract wants strings; "" says "not reported" without inventing a date.
    expect(() => AerialImagery.parse(imagery)).not.toThrow();
    expect(imagery.captureDate).toEqual({ first: "", last: "" });
  });
});

describeLive("live Vexcel API (needs VEXCEL_API_KEY)", () => {
  test("returns an ortho JPEG with parseable metadata for 2600 Travis", async () => {
    const { fetchVexcelImage } = await import("@/lib/data/vexcel");
    const { bytes, xmp } = await fetchVexcelImage({
      lat: TRAVIS.lat,
      lon: TRAVIS.lon,
      kind: "ortho",
      direction: null,
    });
    expect(bytes.length).toBeGreaterThan(10_000);
    expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8])); // JPEG SOI
    expect(xmp?.collection).toBe("us-tx-houston-2026");
    expect(xmp?.minGsd).toBeLessThan(0.2); // centimetre-grade imagery
  }, 60_000);

  test("returns a north oblique JPEG", async () => {
    const { fetchVexcelImage } = await import("@/lib/data/vexcel");
    const { bytes, xmp } = await fetchVexcelImage({
      lat: TRAVIS.lat,
      lon: TRAVIS.lon,
      kind: "oblique",
      direction: "north",
    });
    expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(xmp?.productType).toBe("oblique-north");
  }, 60_000);

  test("getAerialImagery returns a contract-valid record end to end", async () => {
    const { getAerialImagery } = await import("@/lib/data/vexcel");
    const imagery = await getAerialImagery(TRAVIS.id, TRAVIS.lat, TRAVIS.lon, "ortho", null);
    expect(() => AerialImagery.parse(imagery)).not.toThrow();
    expect(imagery.collection).toBe("us-tx-houston-2026");
    expect(imagery.imageUrl.startsWith("/api/")).toBe(true);
  }, 60_000);
});
