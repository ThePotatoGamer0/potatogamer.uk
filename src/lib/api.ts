export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init: RequestInit & { password?: string } = {}): Promise<T> {
  const { password, headers: incoming, ...rest } = init;
  const headers = new Headers(incoming);
  if (rest.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (password) headers.set("Authorization", `Bearer ${password}`);
  const response = await fetch(path, { ...rest, headers });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new ApiError(response.status, data.error || `Request failed (${response.status})`);
  }
  return data as T;
}
