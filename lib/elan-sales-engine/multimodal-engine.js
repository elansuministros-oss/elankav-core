const TYPE_MAP = {
  chat: "text",
  text: "text",
  image: "image",
  audio: "audio",
  ptt: "audio",
  voice: "audio",
  document: "pdf",
  file: "pdf",
  location: "location",
  video: "video",
};

export function analyzeMultimodalInput(normalized = {}) {
  const rawType = String(normalized.type || "").toLowerCase();
  const modality = TYPE_MAP[rawType] || (normalized.hasMedia ? "file" : "text");
  const supported = ["text", "audio", "image", "pdf", "location"].includes(modality);

  return {
    modality,
    rawType,
    hasMedia: Boolean(normalized.hasMedia),
    supported,
    videoEnabled: false,
    acceptedModalities: ["text", "audio", "image", "pdf", "location"],
  };
}
