import { listAccounts } from "../accounts/registry.ts";
import { ensureAccounts, getDb } from "./client.ts";

let done = false;

export function bootstrap(): void {
  if (done) return;
  getDb();
  ensureAccounts(listAccounts());
  done = true;
}
