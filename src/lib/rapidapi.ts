import type { BankOption, PaystackResolveResponse } from "@/types";

/**
 * Bank account number verification via RapidAPI.
 *
 * Replaces Paystack's `/bank/resolve` for account-name lookups. Paystack
 * itself (`src/lib/paystack.ts`) is intentionally left untouched — it still
 * powers the withdrawal-verification-fee and advertiser payment flows, and
 * stays available as a drop-in fallback/alternate provider if needed later.
 *
 * Provider: "Nigeria Bank Account validation" on RapidAPI
 * https://rapidapi.com/donejeh/api/nigeria-bank-account-validation
 *
 * Required env vars:
 *   RAPIDAPI_KEY  — your RapidAPI key (X-RapidAPI-Key)
 *   RAPIDAPI_HOST — defaults to nigeria-bank-account-validation.p.rapidapi.com
 */

const RAPIDAPI_HOST =
  process.env.RAPIDAPI_HOST ?? "nigeria-bank-account-validation.p.rapidapi.com";
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}`;

function rapidApiHeaders() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY is not configured");

  return {
    "X-RapidAPI-Key": key,
    "X-RapidAPI-Host": RAPIDAPI_HOST,
  };
}

/**
 * Static Nigerian bank/institution list with CBI bank codes.
 *
 * The RapidAPI account-validation provider doesn't expose a "list all banks"
 * endpoint — account resolution just needs a valid `bank_code`, so the list
 * of banks shown in the UI (name -> code) is bundled locally instead of
 * fetched over the network on every page load. Update this list if new
 * banks/PSBs/MFBs launch in Nigeria.
 */
const NIGERIAN_BANKS: BankOption[] = [
  { name: "9mobile 9Payment Service Bank", code: "120001" },
  { name: "Abbey Mortgage Bank", code: "801" },
  { name: "Above Only MFB", code: "51204" },
  { name: "Abulesoro MFB", code: "51312" },
  { name: "Access Bank", code: "044" },
  { name: "Access Bank (Diamond)", code: "063" },
  { name: "Airtel Smartcash PSB", code: "120004" },
  { name: "ALAT by WEMA", code: "035A" },
  { name: "Amju Unique MFB", code: "50926" },
  { name: "Aramoko MFB", code: "50083" },
  { name: "ASO Savings and Loans", code: "401" },
  { name: "Astrapolaris MFB LTD", code: "MFB50094" },
  { name: "Bainescredit MFB", code: "51229" },
  { name: "Bowen Microfinance Bank", code: "50931" },
  { name: "Carbon", code: "565" },
  { name: "CEMCS Microfinance Bank", code: "50823" },
  { name: "Chanelle Microfinance Bank Limited", code: "50171" },
  { name: "Citibank Nigeria", code: "023" },
  { name: "Corestep MFB", code: "50204" },
  { name: "Coronation Merchant Bank", code: "559" },
  { name: "Crescent MFB", code: "51297" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Ekimogun MFB", code: "50263" },
  { name: "Ekondo Microfinance Bank", code: "562" },
  { name: "Eyowo", code: "50126" },
  { name: "Fidelity Bank", code: "070" },
  { name: "Firmus MFB", code: "51314" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "First City Monument Bank", code: "214" },
  { name: "FSDH Merchant Bank Limited", code: "501" },
  { name: "Gateway Mortgage Bank LTD", code: "812" },
  { name: "Globus Bank", code: "00103" },
  { name: "GoMoney", code: "100022" },
  { name: "Guaranty Trust Bank", code: "058" },
  { name: "Hackman Microfinance Bank", code: "51251" },
  { name: "Hasal Microfinance Bank", code: "50383" },
  { name: "Heritage Bank", code: "030" },
  { name: "HopePSB", code: "120002" },
  { name: "Ibile Microfinance Bank", code: "51244" },
  { name: "Ikoyi Osun MFB", code: "50439" },
  { name: "Infinity MFB", code: "50457" },
  { name: "Jaiz Bank", code: "301" },
  { name: "Kadpoly MFB", code: "50502" },
  { name: "Keystone Bank", code: "082" },
  { name: "Kredi Money MFB LTD", code: "50200" },
  { name: "Kuda Bank", code: "50211" },
  { name: "Lagos Building Investment Company Plc.", code: "90052" },
  { name: "Links MFB", code: "50549" },
  { name: "Living Trust Mortgage Bank", code: "031" },
  { name: "Lotus Bank", code: "303" },
  { name: "Mayfair MFB", code: "50563" },
  { name: "Mint MFB", code: "50304" },
  { name: "MTN Momo PSB", code: "120003" },
  { name: "Paga", code: "100002" },
  { name: "PalmPay", code: "999991" },
  { name: "Parallex Bank", code: "104" },
  { name: "Parkway - ReadyCash", code: "311" },
  { name: "Paycom", code: "999992" },
  { name: "Petra Mircofinance Bank Plc", code: "50746" },
  { name: "Polaris Bank", code: "076" },
  { name: "Polyunwana MFB", code: "50864" },
  { name: "PremiumTrust Bank", code: "105" },
  { name: "Providus Bank", code: "101" },
  { name: "QuickFund MFB", code: "51293" },
  { name: "Rand Merchant Bank", code: "502" },
  { name: "Refuge Mortgage Bank", code: "90067" },
  { name: "Rubies MFB", code: "125" },
  { name: "Safe Haven MFB", code: "51113" },
  { name: "Solid Rock MFB", code: "50800" },
  { name: "Sparkle Microfinance Bank", code: "51310" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Standard Chartered Bank", code: "068" },
  { name: "Stellas MFB", code: "51253" },
  { name: "Sterling Bank", code: "232" },
  { name: "Suntrust Bank", code: "100" },
  { name: "TAJ Bank", code: "302" },
  { name: "Tangerine Money", code: "51269" },
  { name: "TCF MFB", code: "51211" },
  { name: "Titan Bank", code: "102" },
  { name: "Unical MFB", code: "50871" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "United Bank For Africa", code: "033" },
  { name: "Unity Bank", code: "215" },
  { name: "VFD Microfinance Bank Limited", code: "566" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
];

/** Return the bundled list of Nigerian banks (name + CBN bank code). */
export async function fetchBanks(): Promise<BankOption[]> {
  return NIGERIAN_BANKS;
}

/** Verify a bank account number against a bank code via RapidAPI. */
export async function resolveAccount(
  accountNumber: string,
  bankCode: string
): Promise<PaystackResolveResponse> {
  const url = `${RAPIDAPI_BASE}/?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`;

  const res = await fetch(url, {
    headers: rapidApiHeaders(),
    cache: "no-store",
  });

  const json = await res.json();

  // The provider returns account_name (sometimes nested under `data`) on
  // success, and an `error`/`message` field on failure.
  const data = json.data ?? json;
  const accountName: string | undefined = data.account_name ?? data.accountName;

  if (!res.ok || !accountName) {
    throw new Error(json.message ?? json.error ?? "Account verification failed");
  }

  return {
    account_number: data.account_number ?? accountNumber,
    account_name: accountName,
    bank_id: 0,
  };
}
