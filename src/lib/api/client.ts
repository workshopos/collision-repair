import { apiRequest } from "@/src/lib/api/request";

export async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  fallbackMessage: string,
): Promise<T> {
  const result = await apiRequest<T>(input, init);

  if (!result.ok) {
    throw new Error(result.error || fallbackMessage);
  }

  return result.data;
}
