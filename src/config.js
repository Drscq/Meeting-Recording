const path = require("node:path");

const { ConfigError } = require("./errors");

const VALID_TRANSCRIPTION_MODES = new Set(["auto", "openai", "local"]);

function parseOptionalPositiveInteger(value, name) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ConfigError(`${name} must be a positive integer.`);
  }

  return parsed;
}

function loadConfig(env = process.env) {
  const transcriptionMode = env.TRANSCRIPTION_MODE || "auto";

  if (!VALID_TRANSCRIPTION_MODES.has(transcriptionMode)) {
    throw new ConfigError(
      `TRANSCRIPTION_MODE must be one of: ${Array.from(VALID_TRANSCRIPTION_MODES).join(", ")}.`
    );
  }

  return {
    notionToken: env.NOTION_TOKEN || "",
    notionParentPageId: env.NOTION_PARENT_PAGE_ID || "",
    notionDatabaseTitle: env.NOTION_DATABASE_TITLE || "Meeting Transcripts",
    openaiApiKey: env.OPENAI_API_KEY || "",
    openaiTranscriptionModel: env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
    openaiSummaryModel: env.OPENAI_SUMMARY_MODEL || "gpt-4.1-mini",
    transcriptionMode,
    localTranscribeCommand: env.LOCAL_TRANSCRIBE_COMMAND || "",
    recordingDevice: env.RECORDING_DEVICE || ":0",
    recordingDurationSec: parseOptionalPositiveInteger(env.RECORDING_DURATION_SEC, "RECORDING_DURATION_SEC"),
    recordingsDir: env.RECORDINGS_DIR
      ? path.resolve(env.RECORDINGS_DIR)
      : path.resolve(process.cwd(), ".recordings")
  };
}

function assertNotionConfig(config) {
  if (!config.notionToken) {
    throw new ConfigError("NOTION_TOKEN is required to save transcripts to Notion.");
  }

  if (!config.notionParentPageId) {
    throw new ConfigError("NOTION_PARENT_PAGE_ID is required to create or use the Notion database.");
  }
}

function assertOpenAIConfig(config) {
  if (!config.openaiApiKey) {
    throw new ConfigError("OPENAI_API_KEY is required when using OpenAI transcription.");
  }
}

module.exports = {
  VALID_TRANSCRIPTION_MODES,
  assertNotionConfig,
  assertOpenAIConfig,
  loadConfig
};

