#!/usr/bin/env node
import chalk from "chalk";
import process from "node:process";
import type { WriteStream } from "node:tty";
import { spawnSync } from "node:child_process";
import wrapAnsi from "wrap-ansi";
import dedent from "dedent";
import { resolve } from "node:path";
import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import serveAuto, { readFile } from "./serve.js";
import { type Config, createRequestHandler } from "./index.js";

function colorLog(color: (_: string) => string, tag: string, message: string) {
  return (
    wrapAnsi(message, process.stdout.columns - 7, {
      hard: true,
      trim: false,
    })
      .split("\n")
      .map((e, i) => (i ? `      ` : color("[" + tag + "]")) + " " + e)
      .join("\n") + "\n"
  );
}
function logErr(message: string) {
  process.stderr.write(colorLog(chalk.red, "oops", message));
}
function logWarn(message: string) {
  process.stderr.write(colorLog(chalk.yellow, "warn", message));
}

function banner(stream: WriteStream) {
  stream.write(colorLog(chalk.magenta, "ixie", "JS tooling for today"));
}
function help(stream: WriteStream) {
  stream.write(
    colorLog(
      chalk.blue,
      "help",
      dedent`
    usage:
      ixie <command>
    commands:${
      "\n" +
      Object.keys(commands)
        .map((e) => "      " + e)
        .join("\n")
    }
  `,
    ),
  );
}

const helpAliases: Record<string, string> = {
  "-h": "help",
  "-?": "help",
  "--help": "help",
  "-help": "help",
};

function run(argv: string[], env?: Record<string, string>): number {
  function help(stream: WriteStream) {
    stream.write(
      colorLog(
        chalk.blue,
        "help",
        dedent`
          usage:
            ixie run <file> [args...]
        `,
      ),
    );
  }
  if (helpAliases[argv[0]!] === "help") {
    banner(process.stdout);
    help(process.stdout);
    return 0;
  }
  if (!argv.length) {
    banner(process.stderr);
    logErr("file is required");
    help(process.stderr);
    return 1;
  }
  try {
    argv[0] = resolve(argv[0]!);
  } catch {}
  const rtArgs =
    "Bun" in globalThis
      ? ["run"]
      : ["--import", new URL("register.js", import.meta.url).href];
  return (
    spawnSync(process.execPath, [...rtArgs, ...argv], {
      stdio: "inherit",
      env,
    }).status || 0
  );
}

async function serve(): Promise<number> {
  let config_: { config: Config; url: URL } = {
    config: {},
    url: pathToFileURL(process.cwd() + "/") as any,
  };
  try {
    const loaded = await loadConfig();
    if (loaded) {
      config_ = loaded;
    } else {
      logWarn("couldn't find an ixie config, using defaults + . as base");
    }
  } catch (e: any) {
    logErr(`failed to load your ixie config at ${e.configPath}:\n${e.error}`);
    return 1;
  }
  const { config, url: configURL } = config_;
  const address = await serveAuto({
    fetch: await createRequestHandler(configURL, config, fs, readFile),
    ...(config.serve || {}),
  });
  process.stdout.write(
    colorLog(chalk.magenta, "ixie", "listening at " + address.url),
  );

  return 0;
}

async function loadConfig(): Promise<null | { config: Config; url: URL }> {
  let configPath: string | undefined;
  {
    let dir = process.cwd();
    let up = resolve(dir, "..");
    while (!configPath && dir !== up) {
      for (const ext of [".js", ".cjs", ".mjs", ".ts", ".cts", ".mts"]) {
        const tryPath = resolve(dir, "ixie.config" + ext);
        if (fs.statSync(tryPath, { throwIfNoEntry: false })) {
          configPath = tryPath;
          break;
        }
      }
      dir = up;
      up = resolve(dir, "..");
    }
  }
  if (!configPath) {
    return null;
  }
  try {
    if (!("Bun" in globalThis)) await import("./register.js");
    const url = pathToFileURL(configPath) as URL;
    const { default: configDefinition } = await import(url.href);
    const config: unknown = await (typeof configDefinition === "function"
      ? configDefinition()
      : configDefinition);
    if (config === null || typeof config !== "object")
      throw new Error(
        "expected an object as the config, got " +
          (typeof config === "string"
            ? JSON.stringify(config)
            : String(config)),
      );
    return {
      config: config as Config,
      url,
    };
  } catch (error) {
    throw {
      configPath,
      error,
    };
  }
}

const commands: Record<string, (argv: string[]) => number | Promise<number>> = {
  run,
  serve,
  async build() {
    const config = await loadConfig();
    if (!config) return 1;
    logWarn("todo: implement build");
    return 0;
  },
  help() {
    banner(process.stdout);
    help(process.stdout);
    return 0;
  },
};

const mainAliases: Record<string, string> = { ...helpAliases, dev: "serve" };

(async function main() {
  let [command, ...commandArgv] = process.argv.slice(2);
  command = command || "";
  command = mainAliases[command] || command;
  const fn = commands[command];
  if (fn) {
    const code = await fn(commandArgv);
    if (code) {
      process.exit(code);
    }
  } else {
    banner(process.stderr);
    if (command) {
      logErr("unknown command " + JSON.stringify(command));
    } else {
      logErr("please provide a command");
    }
    help(process.stderr);
    return 1;
  }
})();
