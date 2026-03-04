const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");

const { assertOpenAIConfig } = require("./config");
const { ConfigError, WorkflowError } = require("./errors");

function injectInput(commandTemplate, filePath) {
  const quotedInput = JSON.stringify(filePath);

  if (commandTemplate.includes("{input}")) {
    return commandTemplate.replaceAll("{input}", quotedInput);
  }

  return `${commandTemplate} ${quotedInput}`;
}

function runShellCommand(command, options = {}) {
  const spawnImpl = options.spawnImpl || spawn;

  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, {
      shell: true,
      cwd: options.cwd
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.once("error", (error) => {
      reject(new WorkflowError(`Failed to start local transcription command: ${error.message}`));
    });

    child.once("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(
        new WorkflowError(
          `Local transcription command exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}.`
        )
      );
    });
  });
}

async function transcribeWithLocalCommand(options) {
  const { filePath, config, runShellCommandFn = runShellCommand } = options;

  if (!config.localTranscribeCommand) {
    throw new ConfigError("LOCAL_TRANSCRIBE_COMMAND is required for local transcription mode.");
  }

  const command = injectInput(config.localTranscribeCommand, filePath);
  const output = await runShellCommandFn(command);
  const transcript = String(output || "").trim();

  if (!transcript) {
    throw new WorkflowError("Local transcription returned empty output.");
  }

  return transcript;
}

async function transcribeWithOpenAI(options) {
  const { filePath, config, fetchImpl = global.fetch, fsImpl = fs } = options;

  assertOpenAIConfig(config);

  if (typeof fetchImpl !== "function") {
    throw new WorkflowError("fetch is required for OpenAI transcription.");
  }

  if (typeof File !== "function" || typeof FormData !== "function") {
    throw new WorkflowError("This Node runtime does not support File/FormData for OpenAI transcription.");
  }

  const buffer = await fsImpl.readFile(filePath);
  const file = new File([buffer], path.basename(filePath), {
    type: "audio/m4a"
  });
  const form = new FormData();

  form.set("file", file);
  form.set("model", config.openaiTranscriptionModel);
  form.set("response_format", "text");

  const response = await fetchImpl("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`
    },
    body: form
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new WorkflowError(`OpenAI transcription failed: ${response.status} ${detail}`);
  }

  const contentType = response.headers.get("content-type") || "";
  let transcript = "";

  if (contentType.includes("application/json")) {
    const data = await response.json();
    transcript = typeof data.text === "string" ? data.text : "";
  } else {
    transcript = await response.text();
  }

  transcript = transcript.trim();

  if (!transcript) {
    throw new WorkflowError("OpenAI transcription returned empty text.");
  }

  return transcript;
}

async function transcribeFile(options) {
  const { config } = options;
  const mode = config.transcriptionMode;

  if (mode === "openai") {
    return transcribeWithOpenAI(options);
  }

  if (mode === "local") {
    return transcribeWithLocalCommand(options);
  }

  if (mode === "auto") {
    if (config.openaiApiKey) {
      try {
        return await transcribeWithOpenAI(options);
      } catch (error) {
        if (!config.localTranscribeCommand) {
          throw error;
        }
      }
    }

    if (config.localTranscribeCommand) {
      return transcribeWithLocalCommand(options);
    }

    throw new ConfigError(
      "TRANSCRIPTION_MODE=auto requires OPENAI_API_KEY or LOCAL_TRANSCRIBE_COMMAND."
    );
  }

  throw new ConfigError(`Unsupported transcription mode: ${mode}`);
}

module.exports = {
  injectInput,
  runShellCommand,
  transcribeFile,
  transcribeWithLocalCommand,
  transcribeWithOpenAI
};

