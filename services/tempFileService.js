import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_PREFIX = 'elankav-stt-';

function sanitizeExtension(extension = '') {
  const normalized = String(extension)
    .trim()
    .toLowerCase()
    .replace(/^\./, '')
    .replace(/[^a-z0-9]/g, '');

  return normalized || 'bin';
}

export async function createTemporaryAudioFile({
  buffer,
  extension,
  prefix = DEFAULT_PREFIX
} = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return {
      ok: false,
      status: 'TEMP_FILE_CONTENT_MISSING',
      filePath: null,
      sizeBytes: 0
    };
  }

  const safeExtension = sanitizeExtension(extension);
  const randomId = crypto.randomUUID();
  const fileName = `${prefix}${randomId}.${safeExtension}`;
  const filePath = path.join(os.tmpdir(), fileName);

  await fs.writeFile(filePath, buffer, {
    flag: 'wx',
    mode: 0o600
  });

  return {
    ok: true,
    status: 'TEMP_FILE_CREATED',
    filePath,
    sizeBytes: buffer.length
  };
}

export async function removeTemporaryFile(filePath) {
  if (!filePath) {
    return {
      removed: false,
      reason: 'TEMP_FILE_PATH_MISSING'
    };
  }

  try {
    await fs.unlink(filePath);

    return {
      removed: true,
      reason: null
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        removed: false,
        reason: 'TEMP_FILE_NOT_FOUND'
      };
    }

    throw error;
  }
}
