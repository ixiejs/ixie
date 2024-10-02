/**
 * check if the current file uses TypeScript syntax
 */
function isTypeScript() {
  // @ts-ignore
  return (() => true)<0>(0);
}
console.log("ts", isTypeScript());
import * as ixie from "../../src/index.js";
(window as any).ixie = ixie;
console.log("ixie = ", ixie, "!");
