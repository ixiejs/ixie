import { register } from "node:module";
import { addHook } from "pirates";
import { defaultGetFormatWithoutErrors } from "@easrng/import-meta-resolve/lib/get-format.js";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { coreTransform } from "@easrng/sucrase/core.js";
import CJSImportTransformer from "@easrng/sucrase/transformers/CJSImportTransformer.js";
import CJSImportProcessor from "@easrng/sucrase/CJSImportProcessor.js";
import TypeScriptTransformer from "@easrng/sucrase/transformers/TypeScriptTransformer.js";

addHook(
  (code, filename) =>
    coreTransform(code, {
      transformers: {
        CJSImportTransformer,
        CJSImportProcessor,
        TypeScriptTransformer,
      },
      filePath: filename,
      keepUnusedImports: true,
      preserveDynamicImport: true,
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
    ignoreNodeModules: false,
  }
);

register("./loader.js", {
  parentURL: import.meta.url,
});
