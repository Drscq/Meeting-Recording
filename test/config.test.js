const test = require("node:test");
const assert = require("node:assert/strict");

const { ConfigError } = require("../src/errors");
const { loadConfig } = require("../src/config");

test("loadConfig applies defaults", () => {
  const config = loadConfig({});

  assert.equal(config.notionDatabaseTitle, "Meeting Transcripts");
  assert.equal(config.transcriptionMode, "auto");
  assert.equal(config.recordingDevice, ":0");
  assert.match(config.recordingsDir, /\.recordings$/);
});

test("loadConfig rejects invalid transcription mode", () => {
  assert.throws(
    () => loadConfig({ TRANSCRIPTION_MODE: "invalid" }),
    (error) => error instanceof ConfigError
  );
});

