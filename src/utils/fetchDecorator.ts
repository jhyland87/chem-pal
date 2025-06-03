function generateSimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

export async function generateRequestHash(url: string, options: any): Promise<string> {
  const data = {
    url,
    method: options.method || "GET",
    headers: options.headers || {},
    body: options.body || "",
    contentType: options.headers?.["content-type"] || "",
  };

  const dataString = JSON.stringify(data);
  return generateSimpleHash(dataString);
}

export async function fetchDecorator(url: string, options: any = {}): Promise<any> {
  const requestHash = await generateRequestHash(url, options);

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json();
    return { ...response, data, requestHash };
  }

  if (contentType.includes("text/")) {
    const data = await response.text();
    return { ...response, data, requestHash };
  }

  // For binary data (images, files, etc)
  const data = await response.blob();
  return { ...response, data, requestHash };
}
