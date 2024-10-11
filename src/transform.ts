import path from "@easrng/import-meta-resolve/lib/node-path.js";
import { HTMLRewriterWrapper } from "htmlrewriter/dist/html_rewriter_wrapper.js";
import initHTMLRewriter from "htmlrewriter/dist/html_rewriter.js";
import { defaultGetFormatWithoutErrors } from "@easrng/import-meta-resolve/lib/get-format.js";
import { coreTransform, type Transformers } from "@easrng/sucrase/core.js";
import ESMImportTransformer from "@easrng/sucrase/transformers/ESMImportTransformer.js";
import TypeScriptTransformer from "@easrng/sucrase/transformers/TypeScriptTransformer.js";
import type { FS } from "@easrng/import-meta-resolve/lib/resolve.js";
import CJSImportTransformer from "@easrng/sucrase/transformers/CJSImportTransformer.js";
import CJSImportProcessor from "@easrng/sucrase/CJSImportProcessor.js";
import { analyzeCommonJS } from "@endo/cjs-module-analyzer";
import { resolve as ixieResolve } from "./index.js";
import wasmURL from "htmlrewriter/dist/html_rewriter_bg.wasm?url";

const HTMLRewriter = HTMLRewriterWrapper(
  initHTMLRewriter(
    wasmURL.startsWith("file:")
      ? import("node:fs/promises").then(({ readFile }) =>
          readFile(new URL(wasmURL)),
        )
      : wasmURL,
  ),
);

const webify = function (this: URL, url: string | URL) {
  if (typeof url === "string") url = new URL(url);
  if (url.protocol !== "file:") return url.href;
  const urlSegs = url.pathname.split("/");
  const baseSegs = this.pathname.slice(0, -1).split("/");
  while (baseSegs.length && urlSegs.length && baseSegs[0] === urlSegs[0]) {
    baseSegs.shift();
    urlSegs.shift();
  }
  return [""].concat(baseSegs.fill("@..")).concat(urlSegs).join("/");
};

export async function dynamic(
  parent: URL,
  base: URL,
  fs: FS,
  specifier: string,
) {
  try {
    const resolved = ixieResolve(
      specifier,
      fs,
      {
        parentURL: parent.href,
      },
      webify.bind(base),
    );
    let url = new URL(resolved.url);
    return new Response(null, {
      status: 302,
      headers: {
        location:
          (resolved.format === "commonjs" ||
          resolved.format === "typescript:commonjs"
            ? "/@cjsInit"
            : "") + webify.call(base, url),
      },
    });
  } catch (e) {
    console.error(e);
    return new Response(
      "throw new Error(" +
        JSON.stringify("failed to resolve '" + specifier + "'") +
        ")",
      {
        headers: {
          "content-type": "text/javascript",
        },
      },
    );
  }
}

export async function transform(
  file: URL,
  base: URL,
  response: Response,
  fs: FS,
) {
  if (response.status !== 200) return response;
  switch (path.extname(file.pathname)) {
    case ".html":
      return new HTMLRewriter()
        .on("script", {
          element(element) {
            const src = element.getAttribute("src");
            try {
              if (element.getAttribute("type") === "module" && src) {
                try {
                  if (src[0] !== "/") new URL(src);
                } catch {
                  let url = new URL(
                    ixieResolve(
                      src,
                      fs,
                      {
                        parentURL: file.href,
                      },
                      webify.bind(base),
                    ).url,
                  );
                  element.setAttribute("src", webify.call(base, url));
                }
              }
            } catch (e) {
              element.replace(
                "<script>throw new Error(" +
                  JSON.stringify("failed to resolve '" + src + "'").replace(
                    "/",
                    "\\/",
                  ) +
                  ")</script>",
                { html: true },
              );
            }
          },
        } satisfies import("../node_modules/htmlrewriter/dist/types.d.ts").ElementHandlers)
        .transform(response);
    case ".ts":
    case ".mts":
    case ".cts":
    case ".js":
    case ".mjs":
    case ".cjs":
      const script = await response.text();
      const format = defaultGetFormatWithoutErrors(file, fs.readFileSync);
      let result: string;
      if (format === "commonjs" || format === "typescript:commonjs") {
        const commonjs =
          format === "typescript:commonjs"
            ? coreTransform(script, {
                transformers: {
                  CJSImportTransformer,
                  CJSImportProcessor,
                  TypeScriptTransformer,
                },
                filePath: file.pathname,
                preserveDynamicImport: true,
              }).code
            : script;
        const cjsInfo = analyzeCommonJS(commonjs);
        const exports: string[] = cjsInfo.exports.filter(
          (name) => name !== "default" && name !== "__cjsInit",
        );
        const requires: string[] = cjsInfo.requires;
        const exportsList = exports.length ? "," + exports.join(",") : "";
        const requireImports = requires.map((name, id) => {
          try {
            const resolved = ixieResolve(
              name,
              fs,
              {
                parentURL: file.href,
                conditions: ["require"],
              },
              webify.bind(base),
            );
            let url = new URL(resolved.url);
            return `import{default as r$${id},__cjsInit as i$${id}} from ${JSON.stringify(
              webify.call(base, url as any),
            )};`;
          } catch {
            return "";
          }
        });
        result =
          `${requireImports.join(
            "",
          )}let global=globalThis,exports={},module=Object.defineProperty({},"exports",{get(){return exports},set(value){exports=value}}),require=(name)=>{let m={${requires
            .map((name, id) => `${JSON.stringify(name)}:[r$${id},i$${id}]`)
            .join(
              ",",
            )}}[name];if(!m)throw new Error('module '+name+' not loaded');m[1]?.();return m[0]}${exportsList};export{exports as default${exportsList}};export function __cjsInit(){__cjsInit=undefined;(function(__cjsInit${exportsList}${requires
            .map((_, i) => (requireImports[i] ? `,r$${i},i$${i}` : ""))
            .join("")}){` +
          commonjs +
          "\n})();" +
          exports
            .map((name) => `\n;${name} = module.exports.${name}`)
            .join("") +
          "\n}";
      } else {
        const transformers: Transformers = { ESMImportTransformer };
        if (format === "typescript:module") {
          transformers.TypeScriptTransformer = TypeScriptTransformer;
        }
        result = coreTransform(script, {
          transformers,
          injectCreateRequireForImportRequire: true,
          filePath: file.pathname,
          rewriteImportSpecifier(specifier) {
            specifier = eval(specifier);
            try {
              if (specifier[0] !== "/") new URL(specifier);
              return JSON.stringify(specifier);
            } catch {
              const resolved = ixieResolve(
                specifier,
                fs,
                {
                  parentURL: file.href,
                },
                webify.bind(base),
              );
              let url = new URL(resolved.url);
              return JSON.stringify(
                (resolved.format === "commonjs" ||
                resolved.format === "typescript:commonjs"
                  ? "/@cjsInit"
                  : "") + webify.call(base, url),
              );
            }
          },
          dynamicImportFunction: `return import(${JSON.stringify(
            "/@dynamic?base=" +
              encodeURIComponent(webify.call(base, file)) +
              "&specifier=",
          )} + encodeURIComponent(specifier))`,
        }).code;
      }
      const headers = new Headers(response.headers);
      headers.set("content-type", "text/javascript");
      headers.delete("content-length");
      headers.delete("content-range");
      headers.delete("accept-ranges");
      return new Response(result, {
        headers,
      });
    default:
      return response;
  }
}
