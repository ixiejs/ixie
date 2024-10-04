export type Config = {
  serve?: {
    port?: number;
    hostname?: string;
    signal?: AbortSignal;
  };
  publicDir?: string;
  sourceDir?: string;
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

const unwebify = (url: URL, sourceDir: URL, baseDir: URL) => {
  if (url.pathname.startsWith("/@../")) {
    const seggs = url.pathname.split("/").slice(1);
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
    return new URL("." + url.pathname, sourceDir);
  }
};

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
          new URL(url.searchParams.get("base")!, "https://x"),
          sourceDir,
          baseDir,
        );
        return dynamic(
          parent,
          sourceDir,
          fs,
          url.searchParams.get("specifier")!,
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
      }
    };
    const sourceServe = async () => {
      let file: URL;
      try {
        file = unwebify(url, sourceDir, baseDir);
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
      return transform(file, sourceDir, response, fs);
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
      return transform(file, sourceDir, response, fs);
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
  return serveAuto({
    fetch: await createRequestHandler(base, config, fs, readFile),
    ...(config.serve || {}),
  });
}
