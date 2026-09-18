// src/storage.service.ts
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "tenant-media";

const client =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("La subida de imágenes no está configurada todavía (falta SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY).");
    this.name = "StorageNotConfiguredError";
  }
}

/**
 * Sube un archivo al bucket público "tenant-media" y devuelve su URL pública.
 * `folder` agrupa por tipo (logos/covers/staff) y sirve de namespace visual en
 * el bucket; el nombre del archivo es un UUID para no depender de nombres de
 * usuario ni pisar archivos con el mismo nombre.
 */
export async function uploadPublicFile(
  folder: string,
  file: { buffer: Buffer; mimetype: string; originalname: string }
): Promise<string> {
  if (!client) throw new StorageNotConfiguredError();

  const ext = file.originalname.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await client.storage.from(BUCKET).upload(path, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });
  if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
