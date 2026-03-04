const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");

const { WorkflowError } = require("./errors");

function slugify(value) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "meeting";
}

function formatTimestamp(now) {
  return now.toISOString().replace(/[:.]/g, "-");
}

function buildRecordingPath({ title, recordingsDir, now = new Date() }) {
  return path.join(recordingsDir, `${formatTimestamp(now)}-${slugify(title)}.m4a`);
}

function buildRecordingCommand({ inputDevice = ":0", durationSec, outputPath }) {
  if (!outputPath) {
    throw new WorkflowError("Recording output path is required.");
  }

  const args = ["-y", "-f", "avfoundation", "-i", inputDevice, "-ac", "1", "-ar", "16000"];

  if (durationSec) {
    args.push("-t", String(durationSec));
  }

  args.push(outputPath);

  return {
    command: "ffmpeg",
    args
  };
}

function runCommand(command, args, options = {}) {
  const spawnImpl = options.spawnImpl || spawn;

  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, {
      stdio: "inherit",
      cwd: options.cwd
    });

    child.once("error", (error) => {
      reject(new WorkflowError(`Failed to start ${command}: ${error.message}`));
    });

    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new WorkflowError(`${command} exited with code ${code}.`));
    });
  });
}

async function recordMeeting(options) {
  const {
    title,
    config,
    durationSec = config.recordingDurationSec,
    now = new Date(),
    fsImpl = fs,
    runCommandFn = runCommand
  } = options;

  await fsImpl.mkdir(config.recordingsDir, { recursive: true });

  const audioPath = buildRecordingPath({
    title,
    recordingsDir: config.recordingsDir,
    now
  });

  const commandSpec = buildRecordingCommand({
    inputDevice: config.recordingDevice,
    durationSec,
    outputPath: audioPath
  });

  await runCommandFn(commandSpec.command, commandSpec.args);

  return {
    audioPath,
    ...commandSpec
  };
}

module.exports = {
  buildRecordingCommand,
  buildRecordingPath,
  recordMeeting,
  runCommand
};

