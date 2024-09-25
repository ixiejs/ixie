type ServeOptions = {
  fetch: (req: Request) => PromiseLike<Response> | Response;
  port?: number;
  hostname?: string;
  signal?: AbortSignal;
};
type ServeAddress = { hostname: string; port: number; url: string };
type ServeFunction = (options: ServeOptions) => Promise<ServeAddress>;
function getAddress(options: ServeOptions): ServeAddress {
  const address: ServeAddress = {
    port: options.port ?? 3000,
    hostname: options.hostname ?? "::",
    url: "",
  };
  const url = new URL("http://x");
  url.hostname = address.hostname.includes(":")
    ? `[${address.hostname}]`
    : address.hostname;
  url.port = address.port.toString();
  if (url.hostname === "[::]") {
    url.hostname = "localhost";
    address.hostname = "localhost";
  }
  address.url = url.origin;
  return address;
}
type DenoType = {
  serve(
    options: {
      port?: number;
      hostname?: string;
      signal?: AbortSignal | undefined | null;
      reusePort?: boolean;
      onError?: (error: unknown) => Response | Promise<Response>;
      onListen?: (localAddr: unknown) => void;
    },
    handler: (request: Request) => Response | Promise<Response>,
  ): unknown;
};

const serveWeb: ServeFunction = async ({ fetch, signal }) => {
  if (!signal || !signal.aborted) {
    const handler = (
      event: Event & {
        readonly request: Request;
        respondWith(r: Response | PromiseLike<Response>): void;
      },
    ) => {
      event.respondWith(fetch(event.request));
    };
    (globalThis as any).addEventListener("fetch", handler as any);
    signal?.addEventListener(
      "abort",
      () => {
        (globalThis as any).removeEventListener("fetch", handler as any);
      },
      { once: true },
    );
  }
  return Promise.resolve(
    typeof (globalThis as any).location !== "undefined"
      ? {
          hostname: (globalThis as any).location.host,
          port: parseInt((globalThis as any).location.port),
          url: (globalThis as any).location.origin,
        }
      : {
          hostname: "unknown.invalid",
          port: 0,
          url: "http://unknown.invalid",
        },
  );
};
type BunType = {
  serve(options: {
    fetch(request: Request): Response | Promise<Response>;
    hostname?: string;
    port?: string | number;
  }): {
    /**
     * Stop listening to prevent new connections from being accepted.
     *
     * By default, it does not cancel in-flight requests or websockets. That means it may take some time before all network activity stops.
     *
     * @param closeActiveConnections Immediately terminate in-flight requests, websockets, and stop accepting new connections.
     * @default false
     */
    stop(closeActiveConnections?: boolean): void;
  };
};
const serveBun: ServeFunction = async (options) => {
  let Bun;
  if ("Bun" in globalThis) {
    Bun = (globalThis as any).Bun as BunType;
  } else {
    throw new Error("not running in Bun");
  }
  const address = getAddress(options);
  if (!options.signal || !options.signal.aborted) {
    const server = Bun.serve({
      fetch: async (req) => options.fetch(req),
      hostname: address.hostname,
      port: address.port,
    });
    if (options.signal) {
      options.signal.addEventListener("abort", () => server.stop(), {
        once: true,
      });
    }
  }
  return address;
};

const getNodeLibs = () =>
  Promise.all([import("node:stream"), import("node:http")]);
let nodeLibsPromise: ReturnType<typeof getNodeLibs>;
const serveNode: ServeFunction = async (options) => {
  const address = getAddress(options);
  if (!options.signal || !options.signal.aborted) {
    const [nodeStream, nodeHttp] = await (nodeLibsPromise ||
      (nodeLibsPromise = getNodeLibs()));
    if (!options.signal || !options.signal.aborted) {
      let readyResolve: () => void;
      const readyPromise = new Promise<void>(
        (resolve) => (readyResolve = resolve),
      );
      const server = new nodeHttp.Server((req, res) => {
        const handleError = (error: unknown) => {
          if (!error) return;
          console.error("error", error);
          if (res.writable && !res.headersSent && req.readable) {
            res.writeHead(500, ["content-type", "text/plain"]);
            res.write("server error");
            res.end();
            console.error(error);
          }
        };
        res.on("error", handleError);
        req.on("error", handleError);
        try {
          const headers = new Headers();
          for (let i = 0; i < req.rawHeaders.length; i += 2) {
            headers.append(req.rawHeaders[i]!, req.rawHeaders[i + 1]!);
          }
          const stream = nodeStream.Readable.toWeb(req);
          const request = new Request(address.url + req.url, {
            headers,
            body:
              req.method === "GET" || req.method === "HEAD"
                ? undefined
                : (stream as any),
            method: req.method,
          });
          Promise.resolve()
            .then(() => options.fetch(request))
            .then((response) => {
              if (res.headersSent) return;
              res.writeHead(
                response.status,
                response.statusText,
                [...response.headers.entries()].flat(),
              );
              if (response.body) {
                nodeStream.Readable.fromWeb(response.body as any).pipe(res);
              } else {
                res.end();
              }
            }, handleError);
        } catch (error) {
          handleError(error);
        }
      });
      server.listen(address.port, address.hostname, () => {
        readyResolve();
      });
      if (options.signal) {
        options.signal.addEventListener("abort", () => server.close(), {
          once: true,
        });
      }
      await readyPromise;
    }
  }
  return address;
};
const serveDeno: ServeFunction = async (options) => {
  let Deno;
  if ("Deno" in globalThis) {
    Deno = (globalThis as any).Deno as DenoType;
  } else {
    throw new Error("not running in Deno");
  }
  const address = getAddress(options);
  if (!options.signal || !options.signal.aborted) {
    let readyResolve: () => void;
    const readyPromise = new Promise<void>(
      (resolve) => (readyResolve = resolve),
    );
    Deno.serve(
      {
        hostname: address.hostname,
        port: address.port,
        signal: options.signal,
        onListen() {
          readyResolve();
        },
      },
      async (req) => options.fetch(req),
    );
    await readyPromise;
  }
  return address;
};
const serveAuto: ServeFunction = (options) => {
  if ("Bun" in globalThis) {
    return serveBun(options);
  } else if ("Deno" in globalThis) {
    return serveDeno(options);
  } else if (
    typeof (globalThis as any).ServiceWorkerGlobalScope !== "undefined" &&
    globalThis instanceof (globalThis as any).ServiceWorkerGlobalScope
  ) {
    return serveWeb(options);
  } else if (typeof process !== "undefined") {
    return serveNode(options);
  } else {
    throw new Error("Unsupported runtime.");
  }
};

export default serveAuto;
