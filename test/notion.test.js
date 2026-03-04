const test = require("node:test");
const assert = require("node:assert/strict");

const { buildMeetingPagePayload, buildTranscriptBlocks } = require("../src/notion");

test("buildTranscriptBlocks returns the expected section headings", () => {
  const blocks = buildTranscriptBlocks({
    summary: "Short summary",
    keyDecisions: ["Use the hybrid flow."],
    actionItems: ["Create the Notion database."],
    fullTranscript: "This is the full transcript."
  });

  const headings = blocks
    .filter((block) => block.type === "heading_2")
    .map((block) => block.heading_2.rich_text[0].text.content);

  assert.deepEqual(headings, ["Summary", "Key Decisions", "Action Items", "Full Transcript"]);
});

test("buildMeetingPagePayload maps structured transcript into Notion properties", () => {
  const payload = buildMeetingPagePayload({
    databaseId: "db-123",
    title: "Weekly Sync",
    meetingDate: "2026-03-02",
    source: "microphone",
    sections: {
      summary: "Short summary",
      keyDecisions: ["Use the hybrid flow."],
      actionItems: ["Create the Notion database."],
      fullTranscript: "This is the full transcript."
    }
  });

  assert.equal(payload.parent.database_id, "db-123");
  assert.equal(payload.properties.Name.title[0].text.content, "Weekly Sync");
  assert.equal(payload.properties.Source.select.name, "microphone");
  assert.equal(payload.children[0].heading_2.rich_text[0].text.content, "Summary");
});

