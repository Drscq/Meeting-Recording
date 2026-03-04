#!/usr/bin/env node

const { runMeetingWorkflow } = require("../src/workflow");

function printUsage() {
  process.stdout.write(
    [
      "Usage:",
      "  node ./bin/meeting-recording.js run --title <title> [--audio <path>] [--duration <seconds>] [--dry-run] [--source <source>]",
      "",
      "Behavior:",
      "  - If --audio is provided, the workflow ingests that file.",
      "  - If --audio is omitted, the workflow records from the Mac microphone using ffmpeg.",
      "  - Without --dry-run, the workflow saves the transcript into Notion.",
      ""
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = [...argv];
  const parsed = {
    command: "run",
    options: {}
  };

  if (args[0] && !args[0].startsWith("--")) {
    parsed.command = args.shift();
  }

  while (args.length > 0) {
    const token = args.shift();

    if (token === "--help" || token === "-h") {
      parsed.command = "help";
      continue;
    }

    if (token === "--dry-run") {
      parsed.options.dryRun = true;
      continue;
    }

    if (token === "--title") {
      parsed.options.title = args.shift();
      continue;
    }

    if (token === "--audio") {
      parsed.options.audioPath = args.shift();
      continue;
    }

    if (token === "--duration") {
      parsed.options.durationSec = Number.parseInt(args.shift(), 10);
      continue;
    }

    if (token === "--source") {
      parsed.options.source = args.shift();
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return parsed;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.command === "help") {
    printUsage();
    return;
  }

  if (parsed.command !== "run") {
    throw new Error(`Unknown command: ${parsed.command}`);
  }

  const result = await runMeetingWorkflow(parsed.options);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

