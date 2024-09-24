export type Config = {
  serve?: {
    port?: number;
    hostname?: string;
  };
  webRoot?: string;
};
type ConfigDefinition =
  | Config
  | PromiseLike<Config>
  | (() => Config)
  | (() => PromiseLike<Config>);
export function defineConfig<T extends ConfigDefinition>(config: T): T {
  return config;
}

export const createRequestHandler = (
  configURL: URL,
  config: Config,
  fs: import("@easrng/import-meta-resolve/lib/resolve.js").FS,
  readFile: (url: URL, headers?: Headers, status?: number) => Promise<Response>,
) => {
  const webBase = new URL(config.webRoot || ".", configURL);
  const base = new URL(".", configURL);
  webBase.pathname = webBase.pathname.replace(/\/$/, "") + "/";
  base.pathname = base.pathname.replace(/\/$/, "") + "/";
  return async function handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      let file: URL;
      if (url.pathname.startsWith("/@../")) {
        const seggs = url.pathname.split("/").slice(1);
        let count = 0;
        while (seggs[0] === "@..") {
          count++;
          seggs.shift();
        }
        const unsafeFile = new URL(
          "../".repeat(count) + seggs.join("/"),
          webBase,
        );
        if (unsafeFile.href.startsWith(base.href)) {
          // safe!
          file = unsafeFile;
        } else {
          return new Response(
            "unauthorized: you can only access files in the directory your ixie config is in or below!",
            {
              status: 403,
            },
          );
        }
      } else {
        file = new URL("." + url.pathname, webBase);
      }
      return await readFile(file, request.headers);
    } catch {
      try {
        return await readFile(
          new URL("404.html", webBase),
          request.headers,
          404,
        );
      } catch {
        return new Response("file not found", { status: 404 });
      }
    }
  };
};
