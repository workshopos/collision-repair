export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function apiRequest<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(input, init);
  } catch {
    return {
      ok: false,
      error: "Network error - check your connection and try again.",
    };
  }

  let body: unknown = null;
  try {
    const text = await response.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    // Preserve the status-based fallback for empty or non-JSON responses.
  }

  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      body.error &&
      typeof body.error === "object" &&
      "message" in body.error
        ? String(body.error.message)
        : body && typeof body === "object" && "error" in body
          ? String(body.error)
          : `Request failed (${response.status})`;

    return { ok: false, error: message };
  }

  return { ok: true, data: body as T };
}
