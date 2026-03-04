const test = require("node:test");
const assert = require("node:assert/strict");

const { buildRecordingCommand, buildRecordingPath } = require("../src/recorder");

test("buildRecordingCommand targets macOS avfoundation with duration", () => {
  const result = buildRecordingCommand({
    inputDevice: ":1",
    durationSec: 60,
    outputPath: "/tmp/test.m4a"
  });

  assert.equal(result.command, "ffmpeg");
  assert.deepEqual(result.args, [
    "-y",
    "-f",
    "avfoundation",
    "-i",
    ":1",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-t",
    "60",
    "/tmp/test.m4a"
  ]);
});

test("buildRecordingPath slugifies the meeting title", () => {
  const result = buildRecordingPath({
    title: "Weekly Product Sync",
    recordingsDir: "/tmp/recordings",
    now: new Date("2026-03-02T15:04:05.000Z")
  });

  assert.equal(result, "/tmp/recordings/2026-03-02T15-04-05-000Z-weekly-product-sync.m4a");
});

