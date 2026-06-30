/* eslint-disable no-console */

import { createClient } from "@supabase/supabase-js";

const DEFAULT_BUCKET = process.env.EMC_STORAGE_BUCKET || "emc-importaciones";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";

  if (!url || !key) {
    throw new Error("Supabase no configurado en CORE.");
  }

  return { url, key };
}

export function createSupabaseServerClient() {
  const { url, key } = getSupabaseConfig();

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function cleanStoragePath(value = "") {
  return String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^emc-importaciones\/+/, "");
}

export function resolveStorageFile(input = {}) {
  const bucket = input.bucket || input.storage_bucket || input.storageBucket || DEFAULT_BUCKET;

  const path = cleanStoragePath(
    input.storage_path ||
      input.storagePath ||
      input.path ||
      input.ruta ||
      input.file_path ||
      input.filePath ||
      ""
  );

  const name =
    input.nombre ||
    input.name ||
    input.originalFilename ||
    input.filename ||
    path.split("/").pop() ||
    "archivo";

  const mime = input.mime || input.mimetype || input.type || "";

  if (!path && !input.buffer) {
    throw new Error("Archivo sin storage_path.");
  }

  return {
    bucket,
    path,
    name,
    mime,
    original: input,
  };
}

export function detectFileType(file = {}) {
  const name = String(file.name || file.nombre || file.path || file.storage_path || "").toLowerCase();
  const mime = String(file.mime || file.mimetype || file.type || "").toLowerCase();

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";

  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  ) {
    return "excel";
  }

  if (mime.includes("csv") || name.endsWith(".csv")) return "csv";
  if (mime.includes("text") || name.endsWith(".txt")) return "txt";

  if (
    mime.includes("image") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp")
  ) {
    return "image";
  }

  return "unknown";
}

export async function downloadStorageFile(input = {}) {
  const file = resolveStorageFile(input);

  if (input.buffer) {
    const buffer = Buffer.isBuffer(input.buffer)
      ? input.buffer
      : Buffer.from(String(input.buffer), "base64");

    return {
      ...file,
      type: detectFileType(file),
      buffer,
      size: buffer.length,
      source: "payload-buffer",
    };
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.storage.from(file.bucket).download(file.path);

  if (error) {
    throw new Error(`No se pudo descargar archivo desde Storage: ${error.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    ...file,
    type: detectFileType(file),
    buffer,
    size: buffer.length,
    source: "supabase-storage",
  };
}

export default {
  createSupabaseServerClient,
  cleanStoragePath,
  resolveStorageFile,
  detectFileType,
  downloadStorageFile,
};