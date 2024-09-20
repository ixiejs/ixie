import { register } from "node:module";
import { addHook } from "pirates";
import { defaultGetFormatWithoutErrors } from "@easrng/import-meta-resolve/lib/get-format.js";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { transform } from "@easrng/sucrase";

addHook(
  (code, filename) => transform(code, {
    disableESTransforms: true,
    transforms: ['imports', 'typescript'],
    filePath: filename,
    keepUnusedImports: true,
    preserveDynamicImport: true
  }).code,
  {
    exts: [".ts", ".cts"],
    matcher(filename: string) {
      if (extname(filename) === ".cts") return true;
      return (
        defaultGetFormatWithoutErrors(pathToFileURL(filename), {
          parentURL: "",
          readFileSync,
        }) === "typescript:commonjs"
      );
    },
    ignoreNodeModules: false
  }
);

register("./loader.js", {
  parentURL: import.meta.url,
});
