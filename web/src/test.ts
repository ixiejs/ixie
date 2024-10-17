import runtime from "#test";
console.log(runtime);
/**
 * check if the current file uses TypeScript syntax
 */
function isTypeScript() {
  // @ts-ignore
  return (() => true)<0>(0);
}
console.log("ts", isTypeScript());
import * as ixie from "../../src/index.js";
(globalThis as any).ixie = ixie;
console.log("ixie = ", ixie, "!");
// @ts-ignore
import process from "node:process";
// @ts-ignore
import os from "node:os";
// @ts-ignore
import path from "node:path";
// @ts-ignore
import fs from "node:fs";
// @ts-ignore
import v8 from "node:v8";
(v8 as any).getHeapStatistics = () => ({ heap_size_limit: 0 });
(fs as any).writev = () => {
  throw new Error("writev not implemented");
};
// @ts-ignore
import { Buffer } from "node:buffer";
(path as any).win32 = {};
(os as any).constants.errno = {};
(process as any).stderr = {};
(globalThis as any).process = process;
(globalThis as any).Buffer = Buffer;
// @ts-ignore
console.log(await import("@npmcli/arborist"));
