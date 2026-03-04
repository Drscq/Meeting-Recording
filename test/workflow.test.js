const test = require("node:test");
const assert = require("node:assert/strict");

const { runMeetingWorkflow } = require("../src/workflow");

test("runMeetingWorkflow records, transcribes, structures, and saves", async () => {
  const calls = [];
  const notionClient = {
    async saveMeeting(payload) {
      calls.push(payload);
      return { id: "page-123" };
    }
  };

  const result = await runMeetingWorkflow(
    {
      title: "Weekly Sync",
      durationSec: 30
    },
    {
      config: {
        recordingDurationSec: null
      },
      async recordMeeting() {
        return { audioPath: "/tmp/meeting.m4a", command: "ffmpeg", args: [] };
      },
      async transcribeFile() {
        return "We agreed to use Notion.\nAction item: connect the database.";
      },
      async structureTranscript() {
        return {
          summary: "Use Notion.",
          keyDecisions: ["We agreed to use Notion."],
          actionItems: ["Action item: connect the database."],
          fullTranscript: "We agreed to use Notion.\nAction item: connect the database."
        };
      },
      notionClient,
      now: new Date("2026-03-02T15:04:05.000Z")
    }
  );

  assert.equal(result.audioPath, "/tmp/meeting.m4a");
  assert.equal(result.notionPageId, "page-123");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].meetingDate, "2026-03-02");
  assert.equal(calls[0].source, "microphone");
});

test("runMeetingWorkflow supports dry-run mode with an existing audio file", async () => {
  const result = await runMeetingWorkflow(
    {
      title: "Imported Recording",
      audioPath: "./fixtures/meeting.m4a",
      dryRun: true
    },
    {
      config: {
        transcriptionMode: "local",
        localTranscribeCommand: "echo placeholder"
      },
      async transcribeFile(input) {
        assert.match(input.filePath, /fixtures\/meeting\.m4a$/);
        return "Transcript text";
      },
      async structureTranscript() {
        return {
          summary: "Transcript text",
          keyDecisions: ["No explicit decisions were detected automatically. Review the full transcript."],
          actionItems: ["No explicit action items were detected automatically. Review the full transcript."],
          fullTranscript: "Transcript text"
        };
      }
    }
  );

  assert.equal(result.dryRun, true);
  assert.equal(result.notionPageId, null);
  assert.equal(result.source, "audio_file");
});
