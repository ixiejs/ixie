import type {
  FS,
  ResolveResult,
} from "@easrng/import-meta-resolve/lib/resolve.js";
import { defaultResolve as customDefaultResolve } from "@easrng/import-meta-resolve/lib/resolve.js";
import { merge, regexEscape } from "./util.js";

export type Config = {
  serve?: {
    port?: number;
    hostname?: string;
    signal?: AbortSignal;
    config?: Omit<Config, "serve">;
  };
  publicDir?: string;
  sourceDir?: string;
  resolve?: {
    alias?: {
      [prefix: string]:
        | string
        | {
            [condition: string]: string;
          };
    };
    conditions?: string[];
  };
};
type ConfigDefinition =
  | Config
  | PromiseLike<Config>
  | (() => Config)
  | (() => PromiseLike<Config>);
export function defineConfig<T extends ConfigDefinition>(config: T): T {
  return config;
}

function ensureDirectory(...urls: URL[]) {
  for (const url of urls) {
    url.pathname = url.pathname.replace(/\/$/, "") + "/";
  }
}

const unwebify = (urlPath: string, sourceDir: URL, baseDir: URL) => {
  if (urlPath.startsWith("/@../")) {
    const seggs = urlPath.split("/").slice(1);
    let count = 0;
    while (seggs[0] === "@..") {
      count++;
      seggs.shift();
    }
    const unsafeFile = new URL(
      "../".repeat(count) + seggs.join("/"),
      sourceDir,
    );
    if (unsafeFile.href.startsWith(baseDir.href)) {
      // safe!
      return unsafeFile;
    } else {
      throw new Error("unauthorized");
    }
  } else {
    return new URL("." + urlPath, sourceDir);
  }
};

type AliasMap = NonNullable<NonNullable<Config["resolve"]>["alias"]>;
const aliasCache = new WeakMap<AliasMap, RegExp>();
function matchAlias(
  aliasMap: AliasMap,
  conditions: Array<string>,
  specifier: string,
) {
  let regex = aliasCache.get(aliasMap);
  if (!regex) {
    regex = new RegExp(
      `^(${Object.keys(aliasMap).map(regexEscape).join("|")})(\\/.*|$)`,
    );
    aliasCache.set(aliasMap, regex);
  }
  const match = specifier.match(regex);
  if (!match) return specifier;
  const mappedTo = aliasMap[match[1]!]!;
  if (typeof mappedTo === "string") return mappedTo + match[2]!;
  for (const key in mappedTo) {
    if (key === "default" || conditions.includes(key))
      return mappedTo[key] + match[2]!;
  }
  return specifier;
}

export function resolve(
  specifier: string,
  fs: FS,
  context: {
    parentURL?: string;
    conditions?: Array<string>;
  },
  rewriteUrls?: (url: string) => string,
  config?: Config["resolve"],
): ResolveResult {
  const urlMode = specifier.endsWith("?url");
  if (urlMode) specifier = specifier.slice(0, -1 * "?url".length);
  if (config?.alias)
    specifier = matchAlias(config.alias, context.conditions || [], specifier);
  let resolved = customDefaultResolve(specifier, fs, {
    parentURL: context.parentURL,
    conditions: [...(context.conditions || []), ...(config?.conditions || [])],
  });
  if (config?.alias) {
    const newSpecifier = matchAlias(
      config.alias,
      context.conditions || [],
      resolved.url,
    );
    if (newSpecifier !== resolved.url)
      resolved = customDefaultResolve(newSpecifier, fs, {
        parentURL: context.parentURL,
        conditions: [
          ...(context.conditions || []),
          ...(config?.conditions || []),
        ],
      });
  }
  if (urlMode) {
    return {
      url:
        "data:text/javascript;charset=utf-8,export default" +
        JSON.stringify(rewriteUrls ? rewriteUrls(resolved.url) : resolved.url),
      format: "module",
    };
  }
  return resolved;
}

export const createRequestHandler = async (
  configURL: URL,
  config: Config,
  fs: import("@easrng/import-meta-resolve/lib/resolve.js").FS,
  readFile: (url: URL, headers?: Headers, status?: number) => Promise<Response>,
) => {
  const publicDir = new URL(config.publicDir || ".", configURL);
  const sourceDir = new URL(config.sourceDir || ".", configURL);
  const baseDir = new URL(".", configURL);
  ensureDirectory(publicDir, sourceDir, baseDir);
  const { transform, dynamic } = await import("./transform.js");
  return async function handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const dynamicServe = async () => {
      if (url.pathname === "/@dynamic") {
        const parent = unwebify(
          url.searchParams.get("base")!,
          sourceDir,
          baseDir,
        );
        return dynamic(
          parent,
          sourceDir,
          fs,
          url.searchParams.get("specifier")!,
          config,
        );
      } else if (url.pathname.startsWith("/@cjsInit/")) {
        const specifier = JSON.stringify(
          url.pathname.slice("/@cjsInit".length),
        );
        return new Response(
          `export * from ${specifier};\nexport { default } from ${specifier};\nimport { __cjsInit } from ${specifier};\nif(__cjsInit) __cjsInit();`,
          {
            headers: {
              "content-type": "text/javascript",
            },
          },
        );
      } else if (url.pathname.startsWith("/@cjsInterop/")) {
        const specifier = JSON.stringify(
          url.pathname.slice("/@cjsInterop".length),
        );
        return new Response(
          `export * from ${specifier};\nexport { default } from ${specifier};\nexport const __esModule = true;`,
          {
            headers: {
              "content-type": "text/javascript",
            },
          },
        );
      } else if (url.pathname.startsWith("/@json/")) {
        const specifier = url.pathname.slice("/@json".length);
        const file = unwebify(specifier, sourceDir, baseDir);
        return new Response(
          `export default ` +
            JSON.stringify(
              await (await readFile(file, request.headers)).json(),
            ),
          {
            headers: {
              "content-type": "text/javascript",
            },
          },
        );
      }
    };
    const sourceServe = async () => {
      let file: URL;
      try {
        file = unwebify(url.pathname, sourceDir, baseDir);
      } catch {
        return new Response(
          "unauthorized: you can only access files in the directory your ixie config is in or below!",
          {
            status: 403,
          },
        );
      }
      let response: Response;
      try {
        response = await readFile(file, request.headers);
      } catch {
        return;
      }
      return transform(file, sourceDir, response, fs, config);
    };
    const publicServe = async () => {
      try {
        return await readFile(
          new URL("." + url.pathname, publicDir),
          request.headers,
        );
      } catch {}
    };
    const source404 = async () => {
      let response: Response;
      const file = new URL("404.html", sourceDir);
      try {
        response = await readFile(file, request.headers, 404);
      } catch {
        return;
      }
      return transform(file, sourceDir, response, fs, config);
    };
    const public404 = async () => {
      try {
        return await readFile(
          new URL("404.html", publicDir),
          request.headers,
          404,
        );
      } catch {}
    };
    for (const handler of [
      dynamicServe,
      sourceServe,
      publicServe,
      source404,
      public404,
    ]) {
      try {
        const response = await handler();
        if (response) return response;
      } catch (e) {
        console.error(e);
        return new Response("server error", { status: 500 });
      }
    }
    return new Response("file not found", { status: 404 });
  };
};

export async function createServer(
  config: Config,
  base?: URL,
): ReturnType<typeof import("./serve.js").default> {
  const [{ pathToFileURL }, process, fs, { default: serveAuto, readFile }] =
    await Promise.all([
      import("node:url"),
      import("node:process"),
      import("node:fs"),
      import("./serve.js"),
    ]);
  base = base || (pathToFileURL(process.cwd() + "/") as unknown as URL);
  merge(config, config?.serve?.config);
  return serveAuto({
    fetch: await createRequestHandler(base, config, fs, readFile),
    ...(config.serve || {}),
  });
}
