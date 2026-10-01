/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GeminiRequestPayload {
  message?: string;
  prompt?: string;
  history?: Array<{ sender: string; text: string }>;
  userEmail?: string;
}

export interface GeminiApiResponse {
  success?: boolean;
  reply?: string;
  text?: string;
  model?: string;
  latencyMs?: number;
  error?: string;
}

export interface GeminiFetchResult {
  ok: boolean;
  data: GeminiApiResponse | null;
  error: string | null;
  status: number;
}

/**
 * Sends a message or prompt to the Gemini API endpoint on the server.
 * Reads the response as raw text first and safely parses JSON inside a try/catch
 * to prevent "Unexpected end of JSON input" errors.
 *
 * @param payload The request body containing prompt/message and history.
 * @param endpoint The API endpoint (defaults to '/api/gemini/chat').
 * @returns Result object with status, parsed data, and human-readable error if any.
 */
export async function sendGeminiRequest(
  payload: GeminiRequestPayload,
  endpoint: string = "/api/gemini/chat"
): Promise<GeminiFetchResult> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (networkErr: any) {
    return {
      ok: false,
      data: null,
      error: networkErr?.message || "Network error: Unable to reach AI server endpoint.",
      status: 0,
    };
  }

  // 1. Read the response as text first
  let rawText = "";
  try {
    rawText = await response.text();
  } catch (readErr: any) {
    return {
      ok: false,
      data: null,
      error: "Failed to read server response body: " + (readErr?.message || "Stream error"),
      status: response.status,
    };
  }

  // 2. Parse rawText safely with JSON.parse() inside a try/catch block
  let parsedData: any = null;
  let isJsonParseError = false;

  try {
    if (rawText && rawText.trim().length > 0) {
      parsedData = JSON.parse(rawText);
    }
  } catch (parseErr) {
    isJsonParseError = true;
  }

  // 3. If !response.ok or parsing fails, return a clear error structure
  if (!response.ok || isJsonParseError || !parsedData) {
    let errorMessage = "An error occurred while communicating with Gemini API.";

    if (parsedData && parsedData.error) {
      errorMessage = parsedData.error;
      if (typeof errorMessage === "string" && errorMessage.trim().startsWith("{") && errorMessage.trim().endsWith("}")) {
        try {
          const nested = JSON.parse(errorMessage);
          if (nested?.error?.message) {
            errorMessage = nested.error.message;
          }
        } catch {
          // retain
        }
      }
    } else if (parsedData && parsedData.message) {
      errorMessage = parsedData.message;
    } else if (isJsonParseError) {
      errorMessage =
        rawText && rawText.length < 200
          ? `Server returned non-JSON response (${response.status}): ${rawText.trim()}`
          : `Server returned HTTP ${response.status} with non-JSON response.`;
    } else if (!response.ok) {
      errorMessage = `Server request failed with HTTP ${response.status} (${response.statusText || "Error"}).`;
    }

    return {
      ok: false,
      data: parsedData,
      error: errorMessage,
      status: response.status,
    };
  }

  return {
    ok: true,
    data: parsedData,
    error: null,
    status: response.status,
  };
}
