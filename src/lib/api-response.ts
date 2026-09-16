import { NextResponse } from "next/server";

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        request_id: crypto.randomUUID(),
        ...(details === undefined ? {} : { details }),
      },
    },
    { status },
  );
}

export function apiServerError(message = "An unexpected error occurred.") {
  return apiError("INTERNAL_ERROR", message, 500);
}
