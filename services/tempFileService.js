import { promises as fs } from 'node:fs';

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
