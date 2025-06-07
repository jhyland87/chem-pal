export function isAmbeedProductObject(data: unknown): data is AmbeedProductObject {
  return typeof data === "object" && data !== null && "id" in data && typeof data.id === "string";
}
