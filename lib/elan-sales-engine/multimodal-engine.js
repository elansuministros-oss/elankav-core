const TYPE_MAP = {
  chat: "text",
  text: "text",
  image: "image",
  audio: "audio",
  ptt: "audio",
  voice: "audio",
  document: "document",
  file: "document",
  location: "location",
  video: "video",
};

function getMediaName(normalized = {}) {
  const raw = normalized.raw || {};
  const payload = raw.payload || raw.message || raw.data || {};
  const message = payload.message || payload;

  return (
    normalized.fileName ||
    message.filename ||
    message.fileName ||
    message.name ||
    message._data?.filename ||
    payload.filename ||
    payload.fileName ||
    payload.name ||
    ""
  );
}

function getMediaMime(normalized = {}) {
  const raw = normalized.raw || {};
  const payload = raw.payload || raw.message || raw.data || {};
  const message = payload.message || payload;

  return (
    normalized.mimeType ||
    normalized.mimetype ||
    message.mimetype ||
    message.mimeType ||
    message._data?.mimetype ||
    payload.mimetype ||
    payload.mimeType ||
    ""
  );
}

export function analyzeMultimodalInput(normalized = {}) {
  const rawType = String(normalized.type || "").toLowerCase();
  const modality = TYPE_MAP[rawType] || (normalized.hasMedia ? "file" : "text");
  const supported = ["text", "audio", "image", "document", "pdf", "location"].includes(modality);

  return {
    modality,
    rawType,
    hasMedia: Boolean(normalized.hasMedia),
    fileName: getMediaName(normalized),
    mimeType: getMediaMime(normalized),
    supported,
    videoEnabled: false,
    acceptedModalities: ["text", "audio", "image", "document", "pdf", "location"],
  };
}
