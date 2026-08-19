export function parseDataUri(uri: string): { mimeType: string; data: string } | null {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(uri);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}
