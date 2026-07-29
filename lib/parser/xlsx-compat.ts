// The `xlsx` package is plain CJS with no `__esModule` marker, so different
// bundlers disagree about its "default" export: Node's native ESM loader
// puts the whole module.exports under `.default`, while webpack (Next's
// build) sometimes exposes the members directly on the namespace import and
// warns on `import XLSX from "xlsx"`. This resolves to whichever shape
// actually has the content, so the same code works under `node script.ts`,
// the Next.js webpack build, and (if it ever changes again) Turbopack.
import * as XLSXModule from "xlsx";

const resolved = (XLSXModule as unknown as { default?: typeof XLSXModule }).default ?? XLSXModule;

export const XLSX = resolved;
export type WorkBook = import("xlsx").WorkBook;
