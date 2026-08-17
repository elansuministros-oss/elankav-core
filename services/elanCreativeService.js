function requireApiKey() {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY no configurada en CORE.');
    error.code = 'ELAN_CREATIVE_OPENAI_NOT_CONFIGURED';
    throw error;
  }
  return apiKey;
}

function normalizePrompt(prompt) {
  const value = String(prompt || '').trim();
  if (!value) {
    const error = new Error('Se requiere una descripción para generar contenido.');
    error.code = 'ELAN_CREATIVE_PROMPT_REQUIRED';
    throw error;
  }
  return value;
}

export async function generateElanImage({ prompt, size = '1024x1024' } = {}) {
  const apiKey = requireApiKey();
  const cleanPrompt = normalizePrompt(prompt);

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ELAN_IMAGE_MODEL || 'gpt-image-1',
      prompt: cleanPrompt,
      size,
      quality: 'auto',
      output_format: 'png',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'No fue posible generar la imagen.');
    error.code = 'ELAN_IMAGE_GENERATION_FAILED';
    error.details = data;
    throw error;
  }

  const item = Array.isArray(data?.data) ? data.data[0] : null;
  const b64 = item?.b64_json || null;
  const url = item?.url || null;

  if (!b64 && !url) {
    const error = new Error('La generación terminó sin un recurso de imagen utilizable.');
    error.code = 'ELAN_IMAGE_EMPTY_RESULT';
    throw error;
  }

  return {
    kind: 'image',
    model: process.env.ELAN_IMAGE_MODEL || 'gpt-image-1',
    mimeType: 'image/png',
    dataUrl: b64 ? `data:image/png;base64,${b64}` : null,
    url,
    prompt: cleanPrompt,
  };
}

export async function createElanVideo({
  prompt,
  seconds = '4',
  size = '720x1280',
} = {}) {
  const apiKey = requireApiKey();
  const cleanPrompt = normalizePrompt(prompt);
  const form = new FormData();
  form.append('model', process.env.ELAN_VIDEO_MODEL || 'sora-2');
  form.append('prompt', cleanPrompt);
  form.append('seconds', String(seconds));
  form.append('size', String(size));

  const response = await fetch('https://api.openai.com/v1/videos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'No fue posible iniciar la generación del video.');
    error.code = 'ELAN_VIDEO_GENERATION_FAILED';
    error.details = data;
    throw error;
  }

  return {
    kind: 'video-job',
    id: data?.id || null,
    model: data?.model || process.env.ELAN_VIDEO_MODEL || 'sora-2',
    status: data?.status || 'queued',
    progress: data?.progress ?? 0,
    seconds: data?.seconds || String(seconds),
    size: data?.size || String(size),
    prompt: data?.prompt || cleanPrompt,
  };
}

export async function getElanVideoStatus(videoId) {
  const apiKey = requireApiKey();
  const id = String(videoId || '').trim();
  if (!id) {
    const error = new Error('Se requiere el identificador del video.');
    error.code = 'ELAN_VIDEO_ID_REQUIRED';
    throw error;
  }

  const response = await fetch(`https://api.openai.com/v1/videos/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data?.error?.message || 'No fue posible consultar el video.');
    error.code = 'ELAN_VIDEO_STATUS_FAILED';
    error.details = data;
    throw error;
  }

  return {
    kind: 'video-job',
    id: data?.id || id,
    model: data?.model || null,
    status: data?.status || null,
    progress: data?.progress ?? null,
    seconds: data?.seconds || null,
    size: data?.size || null,
    error: data?.error || null,
  };
}
