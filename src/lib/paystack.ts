import type { PaystackBank, PaystackResolveResponse } from "@/types";

const PAYSTACK_BASE = "https://api.paystack.co";

function paystackHeaders() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Fetch list of Nigerian banks from Paystack */
export async function fetchBanks(): Promise<PaystackBank[]> {
  const res = await fetch(`${PAYSTACK_BASE}/bank?country=nigeria&perPage=200`, {
    headers: paystackHeaders(),
    next: { revalidate: 3600 }, // cache 1 hour
  });

  if (!res.ok) throw new Error("Failed to fetch banks from Paystack");

  const json = await res.json();
  return json.data as PaystackBank[];
}

/** Verify a bank account number against a bank code */
export async function resolveAccount(
  accountNumber: string,
  bankCode: string
): Promise<PaystackResolveResponse> {
  const url = `${PAYSTACK_BASE}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`;

  const res = await fetch(url, {
    headers: paystackHeaders(),
    cache: "no-store",
  });

  const json = await res.json();

  if (!res.ok || !json.status) {
    throw new Error(json.message ?? "Account verification failed");
  }

  return json.data as PaystackResolveResponse;
}
