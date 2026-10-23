import { createClient } from "@/lib/supabase/client";

export const DEFAULT_MEDIA_BUCKET = "maintenance-media";

export interface UploadResult {
  url: string | null;
  path: string | null;
  error: string | null;
  isFallbackBase64?: boolean;
}

/**
 * Converts a base64 Data URL to a Blob
 */
function dataUrlToBlob(dataUrl: string): Blob {
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
 * Uploads a binary file, blob, or data URL string (image, video, voice recording, document)
 * to a Supabase Storage bucket and returns its permanent public CDN URL.
 *
 * If the bucket is not yet created in Supabase or fails, it gracefully falls back to Base64
 * so the user experience is never blocked.
 */
export async function uploadMediaToStorage(
  fileOrBlobOrDataUrl: File | Blob | string,
  folder: "photos" | "videos" | "voices" | "documents" = "photos",
  customFileName?: string,
  bucketName: string = DEFAULT_MEDIA_BUCKET
): Promise<UploadResult> {
  // If already an HTTP/HTTPS URL, no upload needed
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

  const supabase = createClient();

  // Convert string data URL to Blob if necessary
  const targetBlob: Blob =
    typeof fileOrBlobOrDataUrl === "string"
      ? dataUrlToBlob(fileOrBlobOrDataUrl)
      : fileOrBlobOrDataUrl;

  // 1. Determine file extension and MIME type
  let extension = "bin";
  let mimeType = targetBlob.type || "application/octet-stream";

  if (targetBlob instanceof File && targetBlob.name) {
    const parts = targetBlob.name.split(".");
    if (parts.length > 1) {
      extension = parts.pop()?.toLowerCase() || "bin";
    }
  } else {
    // Map mime-type to extension for Blobs (like audio recordings or data URLs)
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

  // 2. Generate clean, collision-free filename
  const cleanId = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now();
  const safeName = customFileName
    ? customFileName.replace(/[^a-zA-Z0-9_-]/g, "_")
    : `${timestamp}_${cleanId}`;
  const filePath = `${folder}/${safeName}.${extension}`;

  try {
    // 3. Attempt direct upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, targetBlob, {
        contentType: mimeType,
        cacheControl: "31536000, public", // Cache for 1 year on CDN
        upsert: false,
      });

    if (error) {
      console.warn(`Supabase Storage upload warning (${bucketName}):`, error.message);
      // Fallback: If bucket is missing or permission fails, fallback to Base64
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

    // 4. Retrieve the public CDN URL
    const { data: publicData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return {
      url: publicData.publicUrl,
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
