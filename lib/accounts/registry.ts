import type { AccountConfig } from "./types.ts";
import orangeBurkinaFaso from "./config/orange-burkina-faso.ts";
import mtnNigeria from "./config/mtn-nigeria.ts";

const ACCOUNTS: AccountConfig[] = [orangeBurkinaFaso, mtnNigeria];

export function listAccounts(): AccountConfig[] {
  return ACCOUNTS;
}

export function getAccount(slug: string): AccountConfig | undefined {
  return ACCOUNTS.find((a) => a.slug === slug);
}
