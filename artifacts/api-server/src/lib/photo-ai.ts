import { GoogleGenAI, type Part } from "@google/genai";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod/v4";
import { ObjectStorageService } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { ownsUpload } from "./upload-ownership";
import { logger } from "./logger";

const storage = new ObjectStorageService();
const MAX_BYTES = 10 * 1024 * 1024;
const requests = new Map<string, { count: number; expires: number }>();
let active = 0;

export class PhotoAiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function withPhotoBudget<T>(userId: string, work: () => Promise<T>): Promise<T> {
  const now = Date.now();
  for (const [id, window] of requests) if (window.expires <= now) requests.delete(id);
  const window = requests.get(userId) ?? { count: 0, expires: now + 60_000 };
  if (window.count >= 5 || active >= 2 || requests.size >= 2000) {
    throw new PhotoAiError(429, "Photo assistance is busy. Wait a minute and try again.");
  }
  window.count++;
  requests.set(userId, window);
  active++;
  try { return await work(); } finally { active--; }
}

async function compressedBuffer(data: Buffer): Promise<Buffer> {
  if (data.length > MAX_BYTES) throw new PhotoAiError(413, "Use a photo no larger than 10 MB.");
  try {
    const image = sharp(data, { limitInputPixels: 40_000_000 });
    const meta = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format ?? "")) throw new Error("Unsupported image");
    return await image.rotate().resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
  } catch {
    throw new PhotoAiError(415, "Use a valid JPEG, PNG or WebP photo.");
  }
}

async function compressed(data: Buffer): Promise<Part> {
  return { inlineData: { mimeType: "image/jpeg", data: (await compressedBuffer(data)).toString("base64") } };
}

async function storagePhotoBuffer(objectPath: string, userId: string, ownerOnly: boolean): Promise<Buffer> {
  if (!/^\/objects\/uploads\/[A-Za-z0-9_/-]+$/.test(objectPath) || objectPath.includes("..")) {
    throw new PhotoAiError(400, "Upload a photo using Baqi before requesting photo assistance.");
  }
  let file;
  try { file = await storage.getObjectEntityFile(objectPath); }
  catch { throw new PhotoAiError(404, "The photo was not found. Upload it again."); }
  const allowed = ownerOnly ? await ownsUpload(file, objectPath, userId)
    : await storage.canAccessObjectEntity({ userId, objectFile: file, requestedPermission: ObjectPermission.READ });
  if (!allowed) throw new PhotoAiError(403, "This photo is not yours. Upload your own copy.");
  const [metadata] = await file.getMetadata();
  if (Number(metadata.size) > MAX_BYTES) throw new PhotoAiError(413, "Use a photo no larger than 10 MB.");
  const chunks: Buffer[] = [];
  let size = 0;
  const stream = file.createReadStream();
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BYTES) { stream.destroy(); throw new PhotoAiError(413, "Use a photo no larger than 10 MB."); }
    chunks.push(bytes);
  }
  return compressedBuffer(Buffer.concat(chunks));
}

async function storagePhoto(objectPath: string, userId: string, ownerOnly: boolean): Promise<Part> {
  return {
    inlineData: {
      mimeType: "image/jpeg",
      data: (await storagePhotoBuffer(objectPath, userId, ownerOnly)).toString("base64"),
    },
  };
}

async function storagePhotoDataUrl(objectPath: string, userId: string, ownerOnly: boolean): Promise<string> {
  return `data:image/jpeg;base64,${(await storagePhotoBuffer(objectPath, userId, ownerOnly)).toString("base64")}`;
}

export const referencePhoto = (path: string, userId: string) => storagePhoto(path, userId, true);

export const referencePhotoDataUrl = (path: string, userId: string) => storagePhotoDataUrl(path, userId, true);

export async function listingPhoto(path: string, userId: string): Promise<Part> {
  if (path.startsWith("/objects/")) return storagePhoto(path, userId, false);
  // The three deliberately seeded demo photographs are bundled app assets.
  // Never fetch arbitrary stored URLs or use user-supplied filesystem paths.
  if (!["/demo-tiles.jpg", "/demo-cement.jpg", "/demo-timber.jpg"].includes(path)) {
    throw new PhotoAiError(404, "No supported listing photo.");
  }
  for (const dir of [resolve(process.cwd(), "../baqi/public"), resolve(process.cwd(), "artifacts/baqi/public")]) {
    try { return await compressed(await readFile(resolve(dir, path.slice(1)))); }
    catch (error) { if (error instanceof PhotoAiError) throw error; }
  }
  throw new PhotoAiError(503, "The demo listing photos could not be loaded.");
}

export async function listingPhotoDataUrl(path: string, userId: string): Promise<string> {
  if (path.startsWith("/objects/")) return storagePhotoDataUrl(path, userId, false);
  if (!["/demo-tiles.jpg", "/demo-cement.jpg", "/demo-timber.jpg"].includes(path)) {
    throw new PhotoAiError(404, "No supported listing photo.");
  }
  for (const dir of [resolve(process.cwd(), "../baqi/public"), resolve(process.cwd(), "artifacts/baqi/public")]) {
    try {
      return `data:image/jpeg;base64,${(await compressedBuffer(await readFile(resolve(dir, path.slice(1))))).toString("base64")}`;
    } catch (error) { if (error instanceof PhotoAiError) throw error; }
  }
  throw new PhotoAiError(503, "The demo listing photos could not be loaded.");
}

export async function photoJson<T extends z.ZodType>(prompt: string, parts: Part[], schema: T): Promise<z.infer<T>> {
  if (!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || !process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
    throw new PhotoAiError(503, "Photo assistance is not configured. Manual entry and text search still work.");
  }
  const ai = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL, timeout: 30_000, retryOptions: { attempts: 1 } },
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [{ role: "user", parts: [{ text: prompt }, ...parts] }],
        config: {
          maxOutputTokens: 8192, temperature: 0.1,
          responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(schema),
        },
      });
      if (!response.text) throw new PhotoAiError(502, "No usable photo analysis was returned. Try a clearer photo.");
      return schema.parse(JSON.parse(response.text));
    } catch (error) {
      if (error instanceof PhotoAiError) throw error;
      const status = Number((error as { status?: number }).status);
      if (attempt === 0 && (status === 429 || status >= 500)) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      logger.warn({ providerStatus: Number.isFinite(status) ? status : undefined }, "Gemini photo analysis did not finish");
      throw new PhotoAiError(503, "Photo assistance could not finish. Try again or use manual entry and text search.");
    }
  }
  throw new PhotoAiError(503, "Photo assistance is temporarily unavailable.");
}
