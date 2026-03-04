const path = require("node:path");

const { loadConfig } = require("./config");
const { WorkflowError } = require("./errors");
const { createNotionClient } = require("./notion");
const { recordMeeting } = require("./recorder");
const { structureTranscript } = require("./transcript");
const { transcribeFile } = require("./transcription");

function formatDate(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

async function runMeetingWorkflow(options = {}, dependencies = {}) {
  const config = dependencies.config || loadConfig(dependencies.env);
  const now = options.now || dependencies.now || new Date();
  const title = String(options.title || "").trim();

  if (!title) {
    throw new WorkflowError("Meeting title is required.");
  }

  let audioPath = options.audioPath ? path.resolve(options.audioPath) : null;
  let recordingMeta = null;
  const saveToNotion = !options.dryRun;
  const resolvedSource = options.source || (audioPath ? "audio_file" : "microphone");

  if (!audioPath) {
    const recorder = dependencies.recordMeeting || recordMeeting;
    recordingMeta = await recorder({
      title,
      config,
      durationSec: options.durationSec,
      now,
      fsImpl: dependencies.fsImpl,
      runCommandFn: dependencies.runCommandFn
    });
    audioPath = recordingMeta.audioPath;
  }

  const rawTranscript = await (dependencies.transcribeFile || transcribeFile)({
    filePath: audioPath,
    config,
    fetchImpl: dependencies.fetchImpl,
    fsImpl: dependencies.fsImpl,
    runShellCommandFn: dependencies.runShellCommandFn
  });

  const sections = await (dependencies.structureTranscript || structureTranscript)({
    transcript: rawTranscript,
    title,
    config,
    fetchImpl: dependencies.fetchImpl
  });

  let notionPage = null;

  if (saveToNotion) {
    const notionClient = dependencies.notionClient || createNotionClient({
      config,
      fetchImpl: dependencies.fetchImpl
    });

    notionPage = await notionClient.saveMeeting({
      title,
      meetingDate: formatDate(now),
      source: resolvedSource,
      sections
    });
  }

  return {
    title,
    audioPath,
    source: resolvedSource,
    dryRun: !saveToNotion,
    notionPageId: notionPage?.id || null,
    sections,
    recordingMeta
  };
}

module.exports = {
  runMeetingWorkflow
};

