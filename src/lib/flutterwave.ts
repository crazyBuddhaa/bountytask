import type { BankOption, PaystackResolveResponse } from "@/types";

/**
 * Bank account number verification via Flutterwave.
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
 * Docs:
 *   https://developer.flutterwave.com/v3.0/reference/get-all-banks
 *   https://developer.flutterwave.com/v3.0/reference/resolve-account-transfer-details
 *
 * Required env var:
 *   FLUTTERWAVE_SECRET_KEY — your Flutterwave secret key (Bearer token)
 */

const FLW_BASE = "https://api.flutterwave.com/v3";

function flutterwaveHeaders() {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new Error("FLUTTERWAVE_SECRET_KEY is not configured");

  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${key}`,
  };
}

interface FlutterwaveEnvelope<T> {
  status: string;
  message: string;
  data: T;
}

/** Fetch the list of Nigerian banks (name + code) from Flutterwave. */
export async function fetchBanks(): Promise<BankOption[]> {
  const res = await fetch(`${FLW_BASE}/banks/NG`, {
    headers: flutterwaveHeaders(),
    cache: "no-store",
  });

  const json = (await res.json()) as FlutterwaveEnvelope<
    { id: number; code: string; name: string }[]
  >;

  if (!res.ok || json.status !== "success" || !Array.isArray(json.data)) {
    throw new Error(json.message ?? "Failed to fetch bank list");
  }

  return json.data.map((b) => ({ id: b.id, code: b.code, name: b.name }));
}

/** Verify a bank account number against a bank code via Flutterwave. */
export async function resolveAccount(
  accountNumber: string,
  bankCode: string
): Promise<PaystackResolveResponse> {
  const res = await fetch(`${FLW_BASE}/accounts/resolve`, {
    method: "POST",
    headers: flutterwaveHeaders(),
    body: JSON.stringify({ account_number: accountNumber, account_bank: bankCode }),
    cache: "no-store",
  });

  const json = (await res.json()) as FlutterwaveEnvelope<{
    account_number: string;
    account_name: string;
  }>;

  if (!res.ok || json.status !== "success" || !json.data?.account_name) {
    throw new Error(json.message ?? "Account verification failed");
  }

  return {
    account_number: json.data.account_number ?? accountNumber,
    account_name: json.data.account_name,
    bank_id: 0,
  };
}
