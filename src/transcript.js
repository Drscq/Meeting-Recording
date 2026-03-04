const { WorkflowError } = require("./errors");

function stripCodeFence(value) {
  return String(value || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function normalizeTranscript(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitSentences(value) {
  const matches = value.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  return (matches || []).map((sentence) => sentence.trim()).filter(Boolean);
}

function uniqueList(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function detectLines(value, pattern) {
  return uniqueList(
    value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => pattern.test(line))
  );
}

function heuristicSummary(value) {
  const sentences = splitSentences(value);

  if (sentences.length === 0) {
    return "Transcript captured. Review the full transcript for details.";
  }

  return sentences.slice(0, 3).join(" ");
}

function heuristicallyStructureTranscript(transcript, title = "Meeting") {
  const normalized = normalizeTranscript(transcript);

  if (!normalized) {
    throw new WorkflowError("Transcript was empty after normalization.");
  }

  const keyDecisions = detectLines(
    normalized,
    /\b(decided|decision|agreed|approved|ship|launch|use|keep|choose)\b/i
  );
  const actionItems = detectLines(
    normalized,
    /\b(action item|todo|follow up|follow-up|next step|owner|will|assign)\b/i
  );

  return {
    title,
    summary: heuristicSummary(normalized),
    keyDecisions:
      keyDecisions.length > 0
        ? keyDecisions
        : ["No explicit decisions were detected automatically. Review the full transcript."],
    actionItems:
      actionItems.length > 0
        ? actionItems
        : ["No explicit action items were detected automatically. Review the full transcript."],
    fullTranscript: normalized
  };
}

async function structureWithOpenAI(options) {
  const { transcript, title, config, fetchImpl = global.fetch } = options;

  if (!config.openaiApiKey || typeof fetchImpl !== "function") {
    throw new WorkflowError("OpenAI summary is unavailable.");
  }

  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openaiSummaryModel,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Return valid JSON with keys summary (string), keyDecisions (array of strings), actionItems (array of strings). Keep it concise."
        },
        {
          role: "user",
          content: `Meeting title: ${title}\n\nTranscript:\n${transcript}`
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new WorkflowError(`OpenAI summary failed: ${response.status} ${detail}`);
  }

  const payload = await response.json();
  const rawContent = payload?.choices?.[0]?.message?.content;
  const data = JSON.parse(stripCodeFence(rawContent));

  return {
    summary: String(data.summary || "").trim(),
    keyDecisions: Array.isArray(data.keyDecisions) ? data.keyDecisions.map(String) : [],
    actionItems: Array.isArray(data.actionItems) ? data.actionItems.map(String) : []
  };
}

async function structureTranscript(options) {
  const base = heuristicallyStructureTranscript(options.transcript, options.title);

  if (!options.config?.openaiApiKey) {
    return base;
  }

  try {
    const ai = await structureWithOpenAI(options);

    return {
      ...base,
      summary: ai.summary || base.summary,
      keyDecisions: ai.keyDecisions.length > 0 ? ai.keyDecisions : base.keyDecisions,
      actionItems: ai.actionItems.length > 0 ? ai.actionItems : base.actionItems
    };
  } catch {
    return base;
  }
}

module.exports = {
  heuristicallyStructureTranscript,
  normalizeTranscript,
  structureTranscript,
  structureWithOpenAI
};

