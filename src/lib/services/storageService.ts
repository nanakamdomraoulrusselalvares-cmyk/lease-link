import { createClient } from "@/lib/supabase/client";

export const DEFAULT_MEDIA_BUCKET = "maintenance-media";
export const RECEIPTS_BUCKET = "receipts";

// Maximum limits in bytes
export const MAX_MEDIA_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Allowed MIME types per bucket
export const ALLOWED_MEDIA_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "application/pdf",
]);

export const ALLOWED_RECEIPT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export interface UploadResult {
  url: string | null;
  path: string | null;
  error: string | null;
  isFallbackBase64?: boolean;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  sizeBytes?: number;
}

/**
 * Converts a base64 Data URL to a Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const header = parts[0] || "";
  const base64 = parts[1] || "";
  const mime = header.match(/:(.*?);/)?.[1] || "application/octet-stream";
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

/**
 * Validates a file/blob against size limits, allowed MIME types, and file signatures.
 */
export async function validateStorageFile(
  fileOrBlob: File | Blob,
  bucket: string = DEFAULT_MEDIA_BUCKET
): Promise<FileValidationResult> {
  const sizeBytes = fileOrBlob.size;
  const isReceipt = bucket === RECEIPTS_BUCKET;
  const maxSize = isReceipt ? MAX_RECEIPT_SIZE_BYTES : MAX_MEDIA_SIZE_BYTES;
  const allowedMimes = isReceipt ? ALLOWED_RECEIPT_MIME_TYPES : ALLOWED_MEDIA_MIME_TYPES;

  // 1. File Size Validation
  if (sizeBytes > maxSize) {
    const maxMb = maxSize / (1024 * 1024);
    return {
      valid: false,
      error: `File size exceeds the maximum limit of ${maxMb} MB. Current size: ${(sizeBytes / (1024 * 1024)).toFixed(1)} MB.`,
      sizeBytes,
    };
  }

  // 2. MIME Type Validation
  let mimeType = (fileOrBlob.type || "").toLowerCase();
  if (fileOrBlob instanceof File && fileOrBlob.name) {
    const ext = fileOrBlob.name.split(".").pop()?.toLowerCase();
    if (!mimeType || mimeType === "application/octet-stream") {
      if (ext === "png") mimeType = "image/png";
      else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
      else if (ext === "webp") mimeType = "image/webp";
      else if (ext === "pdf") mimeType = "application/pdf";
      else if (ext === "mp4") mimeType = "video/mp4";
      else if (ext === "webm") mimeType = "video/webm";
      else if (ext === "mp3") mimeType = "audio/mpeg";
      else if (ext === "wav") mimeType = "audio/wav";
    }
  }

  if (mimeType && !allowedMimes.has(mimeType)) {
    return {
      valid: false,
      error: `Disallowed file type (${mimeType}). Only verified media formats (${Array.from(allowedMimes).join(", ")}) are permitted.`,
      sizeBytes,
      mimeType,
    };
  }

  // 3. Binary Magic Bytes Validation (First 8 bytes)
  try {
    const slice = fileOrBlob.slice(0, 8);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // PDF signature: %PDF (0x25, 0x50, 0x44, 0x46)
    if (mimeType === "application/pdf") {
      if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
        return { valid: false, error: "Corrupted or invalid PDF file header.", sizeBytes };
      }
    }

    // PNG signature: 0x89 0x50 0x4E 0x47
    if (mimeType === "image/png") {
      if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) {
        return { valid: false, error: "Corrupted or invalid PNG image signature.", sizeBytes };
      }
    }

    // JPEG signature: 0xFF 0xD8 0xFF
    if (mimeType === "image/jpeg") {
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
        return { valid: false, error: "Corrupted or invalid JPEG image header.", sizeBytes };
      }
    }
  } catch (_) {
    // Gracefully proceed if binary slice is unsupported by environment
  }

  return {
    valid: true,
    sizeBytes,
    mimeType,
  };
}

/**
 * Generates an HMAC-signed temporary access URL for any private storage object.
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number = 3600
): Promise<{ signedUrl: string | null; error: string | null }> {
  if (!path) return { signedUrl: null, error: "Path is required" };

  // If already an absolute HTTP URL with token or third party, return as is
  if (path.startsWith("http://") || path.startsWith("https://")) {
    if (path.includes("token=") || !path.includes("/storage/v1/object/")) {
      return { signedUrl: path, error: null };
    }
  }

  // If Base64 data URL, return directly
  if (path.startsWith("data:")) {
    return { signedUrl: path, error: null };
  }

  const supabase = createClient();

  // Try direct Supabase client call first
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (!error && data?.signedUrl) {
      return { signedUrl: data.signedUrl, error: null };
    }
  } catch (_) {}

  // Fallback to secure server endpoint `/api/storage/signed-url`
  try {
    const res = await fetch("/api/storage/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket, path, expiresIn: expiresInSeconds }),
    });

    const result = await res.json();
    if (result.success && result.signedUrl) {
      return { signedUrl: result.signedUrl, error: null };
    }
    return { signedUrl: null, error: result.error || "Failed to generate signed URL" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Signed URL request error";
    return { signedUrl: null, error: msg };
  }
}

/**
 * Resolves any media URL (photo, video, voice) into an authenticated signed URL
 */
export async function getSignedMediaUrl(
  pathOrUrl: string,
  expiresInSeconds: number = 7200
): Promise<string> {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("data:")) return pathOrUrl;

  // Extract storage path if a full public URL was provided
  let objectPath = pathOrUrl;
  const match = pathOrUrl.match(/maintenance-media\/(.+?)(\?|$)/);
  if (match && match[1]) {
    objectPath = decodeURIComponent(match[1]);
  }

  const { signedUrl } = await createSignedUrl(DEFAULT_MEDIA_BUCKET, objectPath, expiresInSeconds);
  return signedUrl || pathOrUrl;
}

/**
 * Resolves any receipt URL into an authenticated signed URL
 */
export async function getSignedReceiptUrl(
  pathOrUrl: string,
  expiresInSeconds: number = 7200
): Promise<string> {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("data:")) return pathOrUrl;

  let objectPath = pathOrUrl;
  const match = pathOrUrl.match(/receipts\/(.+?)(\?|$)/);
  if (match && match[1]) {
    objectPath = decodeURIComponent(match[1]);
  }

  const { signedUrl } = await createSignedUrl(RECEIPTS_BUCKET, objectPath, expiresInSeconds);
  return signedUrl || pathOrUrl;
}

/**
 * Uploads a binary file, blob, or data URL string to a private Supabase Storage bucket
 * with strict file validation and HMAC signed URL generation.
 */
export async function uploadMediaToStorage(
  fileOrBlobOrDataUrl: File | Blob | string,
  folder: "photos" | "videos" | "voices" | "documents" = "photos",
  customFileName?: string,
  bucketName: string = DEFAULT_MEDIA_BUCKET
): Promise<UploadResult> {
  // If already an external HTTP/HTTPS URL, no upload needed
  if (typeof fileOrBlobOrDataUrl === "string") {
    if (fileOrBlobOrDataUrl.startsWith("http://") || fileOrBlobOrDataUrl.startsWith("https://")) {
      return {
        url: fileOrBlobOrDataUrl,
        path: null,
        error: null,
        isFallbackBase64: false,
      };
    }
  }

  // Convert string data URL to Blob if necessary
  const targetBlob: Blob =
    typeof fileOrBlobOrDataUrl === "string"
      ? dataUrlToBlob(fileOrBlobOrDataUrl)
      : fileOrBlobOrDataUrl;

  // 1. Strict File Validation
  const validation = await validateStorageFile(targetBlob, bucketName);
  if (!validation.valid) {
    return {
      url: null,
      path: null,
      error: validation.error || "File validation failed.",
      isFallbackBase64: false,
    };
  }

  // 2. Determine file extension and MIME type
  let extension = "bin";
  let mimeType = validation.mimeType || targetBlob.type || "application/octet-stream";

  if (targetBlob instanceof File && targetBlob.name) {
    const parts = targetBlob.name.split(".");
    if (parts.length > 1) {
      extension = parts.pop()?.toLowerCase() || "bin";
    }
  } else {
    if (mimeType.includes("webm")) extension = "webm";
    else if (mimeType.includes("mp4")) extension = "mp4";
    else if (mimeType.includes("mpeg") || mimeType.includes("mp3")) extension = "mp3";
    else if (mimeType.includes("ogg")) extension = "ogg";
    else if (mimeType.includes("wav")) extension = "wav";
    else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) extension = "jpg";
    else if (mimeType.includes("png")) extension = "png";
    else if (mimeType.includes("webp")) extension = "webp";
    else if (mimeType.includes("pdf")) extension = "pdf";
  }

  // 3. Generate sanitized, collision-free filename
  const cleanId = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now();
  const safeName = customFileName
    ? customFileName.replace(/[^a-zA-Z0-9_-]/g, "_")
    : `${timestamp}_${cleanId}`;
  const filePath = `${folder}/${safeName}.${extension}`;

  const supabase = createClient();

  try {
    // 4. Upload to private Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, targetBlob, {
        contentType: mimeType,
        cacheControl: "3600, private",
        upsert: false,
      });

    if (error) {
      console.warn(`Supabase Storage upload warning (${bucketName}):`, error.message);
      const base64Fallback =
        typeof fileOrBlobOrDataUrl === "string"
          ? fileOrBlobOrDataUrl
          : await convertBlobToBase64(targetBlob);
      return {
        url: base64Fallback,
        path: null,
        error: null,
        isFallbackBase64: true,
      };
    }

    // 5. Generate secure Signed URL for the private bucket object (Valid for 1 year)
    const { signedUrl } = await createSignedUrl(bucketName, data.path, 60 * 60 * 24 * 365);

    return {
      url: signedUrl || data.path,
      path: data.path,
      error: null,
      isFallbackBase64: false,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Storage upload exception";
    console.warn("Storage upload exception, falling back to Base64:", msg);
    const base64Fallback =
      typeof fileOrBlobOrDataUrl === "string"
        ? fileOrBlobOrDataUrl
        : await convertBlobToBase64(targetBlob);
    return {
      url: base64Fallback,
      path: null,
      error: null,
      isFallbackBase64: true,
    };
  }
}

/**
 * Dedicated helper to securely upload and archive user rent receipts & plan subscription receipts
 * into the private `receipts` bucket.
 */
export async function uploadReceiptToStorage(
  fileOrBlobOrDataUrl: File | Blob | string,
  category: "rent" | "subscriptions",
  landlordId: string,
  receiptNumber: string,
  extension: "png" | "pdf" | "jpg" = "png"
): Promise<UploadResult> {
  const targetBlob: Blob =
    typeof fileOrBlobOrDataUrl === "string"
      ? dataUrlToBlob(fileOrBlobOrDataUrl)
      : fileOrBlobOrDataUrl;

  // 1. Strict validation against receipt rules (Max 10 MB, allowed PDF/PNG/JPEG/WEBP)
  const validation = await validateStorageFile(targetBlob, RECEIPTS_BUCKET);
  if (!validation.valid) {
    return {
      url: null,
      path: null,
      error: validation.error || "Invalid receipt document.",
    };
  }

  const cleanLandlord = (landlordId || "general").replace(/[^a-zA-Z0-9_-]/g, "_");
  const cleanReceipt = receiptNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filePath = `${category}/${cleanLandlord}/${cleanReceipt}.${extension}`;

  const supabase = createClient();
  const mimeType =
    extension === "pdf"
      ? "application/pdf"
      : extension === "jpg"
      ? "image/jpeg"
      : "image/png";

  try {
    const { data, error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(filePath, targetBlob, {
        contentType: mimeType,
        cacheControl: "31536000, private",
        upsert: true, // Allow re-archiving if regenerating
      });

    if (error) {
      console.warn("Receipt storage upload notice:", error.message);
      const base64Fallback =
        typeof fileOrBlobOrDataUrl === "string"
          ? fileOrBlobOrDataUrl
          : await convertBlobToBase64(targetBlob);
      return {
        url: base64Fallback,
        path: null,
        error: null,
        isFallbackBase64: true,
      };
    }

    // Generate signed URL (valid for 30 days)
    const { signedUrl } = await createSignedUrl(RECEIPTS_BUCKET, data.path, 60 * 60 * 24 * 30);

    return {
      url: signedUrl || data.path,
      path: data.path,
      error: null,
      isFallbackBase64: false,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Receipt storage exception";
    console.warn("Receipt upload exception, falling back:", msg);
    const base64Fallback =
      typeof fileOrBlobOrDataUrl === "string"
        ? fileOrBlobOrDataUrl
        : await convertBlobToBase64(targetBlob);
    return {
      url: base64Fallback,
      path: null,
      error: null,
      isFallbackBase64: true,
    };
  }
}

/**
 * Helper to convert File or Blob to DataURL as graceful fallback.
 */
function convertBlobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(blob);
  });
}
