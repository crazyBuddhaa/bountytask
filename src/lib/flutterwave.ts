import type { BankOption, PaystackResolveResponse } from "@/types";

/**
 * Bank account number verification via Flutterwave (v4 API).
 *
 * Replaces an earlier RapidAPI-based provider, which turned out to be
 * unreliable (intermittent timeouts and broken-endpoint errors even on the
 * provider's own example requests). Flutterwave is a well-established
 * Nigerian payments platform with a documented, dynamic bank list + account
 * resolve API.
 *
 * `src/lib/paystack.ts` is intentionally left untouched — it still powers
 * the withdrawal-verification-fee and advertiser payment flows, unrelated
 * to bank account verification.
 *
 * Flutterwave's v4 API authenticates with OAuth2 client-credentials (not a
 * static secret key): exchange FLUTTERWAVE_CLIENT_ID + FLUTTERWAVE_CLIENT_SECRET
 * for a short-lived access token, then use that token as a Bearer header.
 * The "Encryption Key" shown alongside these on the dashboard is only used
 * for encrypting raw card details on direct card charges — not needed here.
 *
 * Docs:
 *   https://developer.flutterwave.com/docs/authentication
 *   https://developer.flutterwave.com/docs/environments
 *   https://developer.flutterwave.com/reference/banks_get
 *   https://developer.flutterwave.com/reference/bank_account_resolve_post
 *
 * Required env vars:
 *   FLUTTERWAVE_CLIENT_ID
 *   FLUTTERWAVE_CLIENT_SECRET
 *   FLUTTERWAVE_ENV — "production" or "sandbox" (defaults to "production")
 */

const TOKEN_URL =
  "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";

const API_BASE =
  process.env.FLUTTERWAVE_ENV === "sandbox"
    ? "https://developersandbox-api.flutterwave.com"
    : "https://f4bexperience.flutterwave.com";

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cachedToken: CachedToken | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 15_000) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.FLUTTERWAVE_CLIENT_ID;
  const clientSecret = process.env.FLUTTERWAVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "FLUTTERWAVE_CLIENT_ID / FLUTTERWAVE_CLIENT_SECRET is not configured"
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    throw new Error(
      `Failed to authenticate with Flutterwave: ${json.error_description ?? json.error ?? res.status}`
    );
  }

  cachedToken = {
    accessToken: json.access_token,
    // expires_in is seconds (typically 600); refresh a little early
    expiresAt: Date.now() + (json.expires_in ?? 540) * 1000,
  };

  return cachedToken.accessToken;
}

async function authHeaders() {
  const token = await getAccessToken();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

interface FlutterwaveEnvelope<T> {
  status: string;
  message?: string;
  data?: T;
  // Failure responses nest the message here instead of top-level `message`,
  // e.g. {"status":"failed","error":{"type":"UNAUTHORIZED","code":"10401","message":"Unauthorized"}}
  error?: { type?: string; code?: string; message?: string };
}

function flutterwaveErrorMessage(json: FlutterwaveEnvelope<unknown>, fallback: string): string {
  return json.error?.message ?? json.message ?? fallback;
}

/** Fetch the list of Nigerian banks (name + code) from Flutterwave. */
export async function fetchBanks(): Promise<BankOption[]> {
  const res = await fetch(`${API_BASE}/banks?country=NG`, {
    headers: await authHeaders(),
    cache: "no-store",
  });

  const json = (await res.json()) as FlutterwaveEnvelope<
    { id: string; code: string; name: string }[]
  >;

  if (!res.ok || json.status !== "success" || !Array.isArray(json.data)) {
    throw new Error(flutterwaveErrorMessage(json, "Failed to fetch bank list"));
  }

  return json.data.map((b, i) => ({ id: i, code: b.code, name: b.name }));
}

/** Verify a bank account number against a bank code via Flutterwave. */
export async function resolveAccount(
  accountNumber: string,
  bankCode: string
): Promise<PaystackResolveResponse> {
  const res = await fetch(`${API_BASE}/banks/account-resolve`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ account: { code: bankCode, number: accountNumber } }),
    cache: "no-store",
  });

  const json = (await res.json()) as FlutterwaveEnvelope<{
    bank_code: string;
    account_number: string;
    account_name: string;
  }>;

  if (!res.ok || json.status !== "success" || !json.data?.account_name) {
    throw new Error(flutterwaveErrorMessage(json, "Account verification failed"));
  }

  return {
    account_number: json.data.account_number ?? accountNumber,
    account_name: json.data.account_name,
    bank_id: 0,
  };
}
