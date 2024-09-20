import { defaultResolve as customDefaultResolve } from "@easrng/import-meta-resolve/lib/resolve.js";
import { defaultGetFormatWithoutErrors } from "@easrng/import-meta-resolve/lib/get-format.js";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import { transform } from "@easrng/sucrase";

type ResolveHook = (
  specifier: string,
  context: {
    conditions: ("node" | "import")[];
    parentURL?: string;
  },
  defaultResolve: ResolveHook
) => Promise<{ url: string }>;

type Format = "builtin" | "commonjs" | "json" | "module" | "wasm";

type LoadHook = (
  url: string,
  context: { format: Format },
  defaultLoad: LoadHook
) => Promise<{
  source: string | SharedArrayBuffer | Uint8Array | undefined;
  format: Format;
  responseURL: string;
  shortCircuit: boolean;
}>;

export const resolve: ResolveHook = async (
  specifier,
  context,
  defaultResolve
) => {
  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (e) {
    const result = customDefaultResolve(specifier, fs, context);
    return {
      url: result.url,
      format: result.format?.split(":")?.at(-1),
    };
  }
};
export const load: LoadHook = async (urlString, context, defaultLoad) => {
  const url = new URL(urlString);
  if (url.protocol === "file:" && /\.[mc]?ts$/.test(url.pathname)) {
    const format = defaultGetFormatWithoutErrors(url, {
      parentURL: "",
      readFileSync: fs.readFileSync,
    });
    if (format === "typescript:module") {
      const source = await readFile(url, "utf-8");
      return {
        source: transform(source, {
          disableESTransforms: true,
          transforms: ["typescript"],
          keepUnusedImports: true,
          injectCreateRequireForImportRequire: true,
          filePath: fileURLToPath(url),
        }).code,
        shortCircuit: true,
        format: "module",
        responseURL: urlString
      };
    } else if (format === "typescript:commonjs") {
      return {
        format: 'commonjs',
        responseURL: urlString,
        source: undefined,
        shortCircuit: true
      }
    }
  }
  const result = await defaultLoad(urlString, context, defaultLoad);
  return result;
};
