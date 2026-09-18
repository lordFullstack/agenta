// src/upload.middleware.ts
import multer from "multer";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error("invalid_file_type"));
    }
    cb(null, true);
  },
}).single("file");
