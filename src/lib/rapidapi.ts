import type { PaystackBank, PaystackResolveResponse } from "@/types";

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
const NIGERIAN_BANKS: PaystackBank[] = [
  { id: 1, name: "9mobile 9Payment Service Bank", slug: "9mobile-9psb", code: "120001", longcode: "120001", country: "Nigeria" },
  { id: 2, name: "Abbey Mortgage Bank", slug: "abbey-mortgage-bank", code: "801", longcode: "000801", country: "Nigeria" },
  { id: 3, name: "Above Only MFB", slug: "above-only-mfb", code: "51204", longcode: "51204", country: "Nigeria" },
  { id: 4, name: "Abulesoro MFB", slug: "abulesoro-mfb", code: "51312", longcode: "51312", country: "Nigeria" },
  { id: 5, name: "Access Bank", slug: "access-bank", code: "044", longcode: "044150149", country: "Nigeria" },
  { id: 6, name: "Access Bank (Diamond)", slug: "access-bank-diamond", code: "063", longcode: "063150162", country: "Nigeria" },
  { id: 7, name: "Airtel Smartcash PSB", slug: "airtel-smartcash-psb", code: "120004", longcode: "120004", country: "Nigeria" },
  { id: 8, name: "ALAT by WEMA", slug: "alat-by-wema", code: "035A", longcode: "035150103", country: "Nigeria" },
  { id: 9, name: "Amju Unique MFB", slug: "amju-unique-mfb", code: "50926", longcode: "50926", country: "Nigeria" },
  { id: 10, name: "Aramoko MFB", slug: "aramoko-mfb", code: "50083", longcode: "50083", country: "Nigeria" },
  { id: 11, name: "ASO Savings and Loans", slug: "aso-savings-and-loans", code: "401", longcode: "401", country: "Nigeria" },
  { id: 12, name: "Astrapolaris MFB LTD", slug: "astrapolaris-mfb", code: "MFB50094", longcode: "MFB50094", country: "Nigeria" },
  { id: 13, name: "Bainescredit MFB", slug: "bainescredit-mfb", code: "51229", longcode: "51229", country: "Nigeria" },
  { id: 14, name: "Bowen Microfinance Bank", slug: "bowen-microfinance-bank", code: "50931", longcode: "50931", country: "Nigeria" },
  { id: 15, name: "Carbon", slug: "carbon", code: "565", longcode: "565", country: "Nigeria" },
  { id: 16, name: "CEMCS Microfinance Bank", slug: "cemcs-microfinance-bank", code: "50823", longcode: "50823", country: "Nigeria" },
  { id: 17, name: "Chanelle Microfinance Bank Limited", slug: "chanelle-microfinance-bank", code: "50171", longcode: "50171", country: "Nigeria" },
  { id: 18, name: "Citibank Nigeria", slug: "citibank-nigeria", code: "023", longcode: "023150005", country: "Nigeria" },
  { id: 19, name: "Corestep MFB", slug: "corestep-mfb", code: "50204", longcode: "50204", country: "Nigeria" },
  { id: 20, name: "Coronation Merchant Bank", slug: "coronation-merchant-bank", code: "559", longcode: "559", country: "Nigeria" },
  { id: 21, name: "Crescent MFB", slug: "crescent-mfb", code: "51297", longcode: "51297", country: "Nigeria" },
  { id: 22, name: "Ecobank Nigeria", slug: "ecobank-nigeria", code: "050", longcode: "050150010", country: "Nigeria" },
  { id: 23, name: "Ekimogun MFB", slug: "ekimogun-mfb", code: "50263", longcode: "50263", country: "Nigeria" },
  { id: 24, name: "Ekondo Microfinance Bank", slug: "ekondo-microfinance-bank", code: "562", longcode: "562", country: "Nigeria" },
  { id: 25, name: "Eyowo", slug: "eyowo", code: "50126", longcode: "50126", country: "Nigeria" },
  { id: 26, name: "Fidelity Bank", slug: "fidelity-bank", code: "070", longcode: "070150003", country: "Nigeria" },
  { id: 27, name: "Firmus MFB", slug: "firmus-mfb", code: "51314", longcode: "51314", country: "Nigeria" },
  { id: 28, name: "First Bank of Nigeria", slug: "first-bank-of-nigeria", code: "011", longcode: "011151003", country: "Nigeria" },
  { id: 29, name: "First City Monument Bank", slug: "first-city-monument-bank", code: "214", longcode: "214150018", country: "Nigeria" },
  { id: 30, name: "FSDH Merchant Bank Limited", slug: "fsdh-merchant-bank", code: "501", longcode: "501", country: "Nigeria" },
  { id: 31, name: "Gateway Mortgage Bank LTD", slug: "gateway-mortgage-bank", code: "812", longcode: "812", country: "Nigeria" },
  { id: 32, name: "Globus Bank", slug: "globus-bank", code: "00103", longcode: "00103", country: "Nigeria" },
  { id: 33, name: "GoMoney", slug: "gomoney", code: "100022", longcode: "100022", country: "Nigeria" },
  { id: 34, name: "Guaranty Trust Bank", slug: "guaranty-trust-bank", code: "058", longcode: "058152036", country: "Nigeria" },
  { id: 35, name: "Hackman Microfinance Bank", slug: "hackman-microfinance-bank", code: "51251", longcode: "51251", country: "Nigeria" },
  { id: 36, name: "Hasal Microfinance Bank", slug: "hasal-microfinance-bank", code: "50383", longcode: "50383", country: "Nigeria" },
  { id: 37, name: "Heritage Bank", slug: "heritage-bank", code: "030", longcode: "030159992", country: "Nigeria" },
  { id: 38, name: "HopePSB", slug: "hopepsb", code: "120002", longcode: "120002", country: "Nigeria" },
  { id: 39, name: "Ibile Microfinance Bank", slug: "ibile-microfinance-bank", code: "51244", longcode: "51244", country: "Nigeria" },
  { id: 40, name: "Ikoyi Osun MFB", slug: "ikoyi-osun-mfb", code: "50439", longcode: "50439", country: "Nigeria" },
  { id: 41, name: "Infinity MFB", slug: "infinity-mfb", code: "50457", longcode: "50457", country: "Nigeria" },
  { id: 42, name: "Jaiz Bank", slug: "jaiz-bank", code: "301", longcode: "301080020", country: "Nigeria" },
  { id: 43, name: "Kadpoly MFB", slug: "kadpoly-mfb", code: "50502", longcode: "50502", country: "Nigeria" },
  { id: 44, name: "Keystone Bank", slug: "keystone-bank", code: "082", longcode: "082150017", country: "Nigeria" },
  { id: 45, name: "Kredi Money MFB LTD", slug: "kredi-money-mfb", code: "50200", longcode: "50200", country: "Nigeria" },
  { id: 46, name: "Kuda Bank", slug: "kuda-bank", code: "50211", longcode: "50211", country: "Nigeria" },
  { id: 47, name: "Lagos Building Investment Company Plc.", slug: "lagos-building-investment-company", code: "90052", longcode: "90052", country: "Nigeria" },
  { id: 48, name: "Links MFB", slug: "links-mfb", code: "50549", longcode: "50549", country: "Nigeria" },
  { id: 49, name: "Living Trust Mortgage Bank", slug: "living-trust-mortgage-bank", code: "031", longcode: "031150038", country: "Nigeria" },
  { id: 50, name: "Lotus Bank", slug: "lotus-bank", code: "303", longcode: "303", country: "Nigeria" },
  { id: 51, name: "Mayfair MFB", slug: "mayfair-mfb", code: "50563", longcode: "50563", country: "Nigeria" },
  { id: 52, name: "Mint MFB", slug: "mint-mfb", code: "50304", longcode: "50304", country: "Nigeria" },
  { id: 53, name: "MTN Momo PSB", slug: "mtn-momo-psb", code: "120003", longcode: "120003", country: "Nigeria" },
  { id: 54, name: "Paga", slug: "paga", code: "100002", longcode: "100002", country: "Nigeria" },
  { id: 55, name: "PalmPay", slug: "palmpay", code: "999991", longcode: "999991", country: "Nigeria" },
  { id: 56, name: "Parallex Bank", slug: "parallex-bank", code: "104", longcode: "104", country: "Nigeria" },
  { id: 57, name: "Parkway - ReadyCash", slug: "parkway-readycash", code: "311", longcode: "311", country: "Nigeria" },
  { id: 58, name: "Paycom", slug: "paycom", code: "999992", longcode: "999992", country: "Nigeria" },
  { id: 59, name: "Petra Mircofinance Bank Plc", slug: "petra-mircofinance-bank", code: "50746", longcode: "50746", country: "Nigeria" },
  { id: 60, name: "Polaris Bank", slug: "polaris-bank", code: "076", longcode: "076151006", country: "Nigeria" },
  { id: 61, name: "Polyunwana MFB", slug: "polyunwana-mfb", code: "50864", longcode: "50864", country: "Nigeria" },
  { id: 62, name: "PremiumTrust Bank", slug: "premiumtrust-bank", code: "105", longcode: "105", country: "Nigeria" },
  { id: 63, name: "Providus Bank", slug: "providus-bank", code: "101", longcode: "101", country: "Nigeria" },
  { id: 64, name: "QuickFund MFB", slug: "quickfund-mfb", code: "51293", longcode: "51293", country: "Nigeria" },
  { id: 65, name: "Rand Merchant Bank", slug: "rand-merchant-bank", code: "502", longcode: "502", country: "Nigeria" },
  { id: 66, name: "Refuge Mortgage Bank", slug: "refuge-mortgage-bank", code: "90067", longcode: "90067", country: "Nigeria" },
  { id: 67, name: "Rubies MFB", slug: "rubies-mfb", code: "125", longcode: "125", country: "Nigeria" },
  { id: 68, name: "Safe Haven MFB", slug: "safe-haven-mfb", code: "51113", longcode: "51113", country: "Nigeria" },
  { id: 69, name: "Solid Rock MFB", slug: "solid-rock-mfb", code: "50800", longcode: "50800", country: "Nigeria" },
  { id: 70, name: "Sparkle Microfinance Bank", slug: "sparkle-microfinance-bank", code: "51310", longcode: "51310", country: "Nigeria" },
  { id: 71, name: "Stanbic IBTC Bank", slug: "stanbic-ibtc-bank", code: "221", longcode: "221159522", country: "Nigeria" },
  { id: 72, name: "Standard Chartered Bank", slug: "standard-chartered-bank", code: "068", longcode: "068150010", country: "Nigeria" },
  { id: 73, name: "Stellas MFB", slug: "stellas-mfb", code: "51253", longcode: "51253", country: "Nigeria" },
  { id: 74, name: "Sterling Bank", slug: "sterling-bank", code: "232", longcode: "232150016", country: "Nigeria" },
  { id: 75, name: "Suntrust Bank", slug: "suntrust-bank", code: "100", longcode: "100", country: "Nigeria" },
  { id: 76, name: "TAJ Bank", slug: "taj-bank", code: "302", longcode: "302", country: "Nigeria" },
  { id: 77, name: "Tangerine Money", slug: "tangerine-money", code: "51269", longcode: "51269", country: "Nigeria" },
  { id: 78, name: "TCF MFB", slug: "tcf-mfb", code: "51211", longcode: "51211", country: "Nigeria" },
  { id: 79, name: "Titan Bank", slug: "titan-bank", code: "102", longcode: "102", country: "Nigeria" },
  { id: 80, name: "Unical MFB", slug: "unical-mfb", code: "50871", longcode: "50871", country: "Nigeria" },
  { id: 81, name: "Union Bank of Nigeria", slug: "union-bank-of-nigeria", code: "032", longcode: "032080474", country: "Nigeria" },
  { id: 82, name: "United Bank For Africa", slug: "united-bank-for-africa", code: "033", longcode: "033153513", country: "Nigeria" },
  { id: 83, name: "Unity Bank", slug: "unity-bank", code: "215", longcode: "215154097", country: "Nigeria" },
  { id: 84, name: "VFD Microfinance Bank Limited", slug: "vfd-microfinance-bank", code: "566", longcode: "566", country: "Nigeria" },
  { id: 85, name: "Wema Bank", slug: "wema-bank", code: "035", longcode: "035150103", country: "Nigeria" },
  { id: 86, name: "Zenith Bank", slug: "zenith-bank", code: "057", longcode: "057150013", country: "Nigeria" },
];

/** Return the bundled list of Nigerian banks (name + CBN bank code). */
export async function fetchBanks(): Promise<PaystackBank[]> {
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
