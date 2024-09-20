import chalk from "chalk";
import { argv as rawArgv, stdout, stderr, exit, execPath } from "node:process";
import type { WriteStream } from "node:tty";
import { spawnSync } from "node:child_process";
import wrapAnsi from "wrap-ansi";
import dedent from "dedent";

function colorLog(color: (_: string) => string, tag: string, message: string) {
  return (
    wrapAnsi(message, stdout.columns - 7, {
      hard: true,
      trim: false,
    })
      .split("\n")
      .map((e, i) => (i ? `      ` : color("[" + tag + "]")) + " " + e)
      .join("\n") + "\n"
  );
}
function logErr(message: string) {
  stderr.write(colorLog(chalk.red, "oops", message));
}
function logWarn(message: string) {
  stderr.write(colorLog(chalk.yellow, "warn", message));
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
  `
    )
  );
}

const helpAliases: Record<string, string> = {
  "-h": "help",
  "-?": "help",
  "--help": "help",
  "-help": "help",
};

const commands: Record<string, (argv: string[]) => number> = {
  run(argv) {
    function help(stream: WriteStream) {
      stream.write(
        colorLog(
          chalk.blue,
          "help",
          dedent`
            usage:
              ixie run <file> [args...]
          `
        )
      );
    }
    if (helpAliases[argv[0]!] === "help") {
      banner(stdout);
      help(stdout);
      return 0;
    }
    if (!argv.length) {
      banner(stderr);
      logErr("file is required");
      help(stderr);
      return 1;
    }
    if (argv[0] === "--") argv.shift()
    return (
      spawnSync(execPath, [
        "--import",
        new URL("register.js", import.meta.url).href,
        ...argv,
      ], {
        stdio: 'inherit'
      }).status || 0
    );
  },
  dev() {
    logWarn("todo: implement dev");
    return 0;
  },
  build() {
    logWarn("todo: implement build");
    return 0;
  },
  help() {
    banner(stdout);
    help(stdout);
    return 0;
  },
};

const mainAliases: Record<string, string> = { ...helpAliases };

function run(): number {
  let [command, ...commandArgv] = rawArgv.slice(2);
  command = command || "";
  command = mainAliases[command] || command;
  const fn = commands[command];
  if (fn) {
    return fn(commandArgv);
  } else {
    banner(stderr);
    if (command) {
      logErr("unknown command " + JSON.stringify(command));
    } else {
      logErr("please provide a command");
    }
    help(stderr);
    return 1;
  }
}
exit(run());
