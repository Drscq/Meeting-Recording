const test = require("node:test");
const assert = require("node:assert/strict");

const { heuristicallyStructureTranscript } = require("../src/transcript");

test("heuristicallyStructureTranscript extracts summary, decisions, and action items", () => {
  const transcript = [
    "We agreed to use Notion as the main archive for meeting notes.",
    "Action item: Sunny will connect the Notion database this week.",
    "Next step: test the audio capture flow on the MacBook."
  ].join("\n");

  const sections = heuristicallyStructureTranscript(transcript, "Planning");

  assert.match(sections.summary, /We agreed to use Notion/);
  assert.deepEqual(sections.keyDecisions, [
    "We agreed to use Notion as the main archive for meeting notes."
  ]);
  assert.deepEqual(sections.actionItems, [
    "Action item: Sunny will connect the Notion database this week.",
    "Next step: test the audio capture flow on the MacBook."
  ]);
});

