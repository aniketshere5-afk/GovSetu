export type UploadResult = { url: string; fileName: string; size: number };

/** Uploads a file to the local /api/upload endpoint (multipart/form-data, session-authenticated). */
export async function uploadFile(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file);

  const res = await fetch("/api/upload", { method: "POST", body, credentials: "include" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || `Upload failed (${res.status})`);
  }

  return data as UploadResult;
}
