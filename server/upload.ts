import express, { type Express, type Request, type Response } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { sdk } from "./_core/sdk";

// Real local-disk document storage — no external object-storage dependency
// required, so uploads work in local dev and on any deployment with a
// persistent disk (e.g. a Railway volume mounted at UPLOAD_DIR).
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const MAX_BYTES = 15 * 1024 * 1024; // 15MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 10);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, PNG, JPEG, WEBP.`));
      return;
    }
    cb(null, true);
  },
});

/** Require a signed-in session; sdk.authenticateRequest throws when there isn't one. */
async function requireSession(req: Request, res: Response): Promise<boolean> {
  try {
    await sdk.authenticateRequest(req);
    return true;
  } catch {
    res.status(401).json({ error: "Sign in required" });
    return false;
  }
}

export function registerUploadRoutes(app: Express) {
  // Uploaded documents are personal — require a signed-in session to read them back.
  app.use("/uploads", async (req, res, next) => {
    if (await requireSession(req, res)) next();
  });
  app.use("/uploads", express.static(UPLOAD_DIR));

  app.post("/api/upload", async (req: Request, res: Response) => {
    if (!(await requireSession(req, res))) return;

    upload.single("file")(req, res, err => {
      if (err) {
        res.status(400).json({ error: err.message || "Upload failed" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }
      res.json({
        url: `/uploads/${req.file.filename}`,
        fileName: req.file.originalname,
        size: req.file.size,
      });
    });
  });
}
