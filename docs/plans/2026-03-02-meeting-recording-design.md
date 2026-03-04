# Meeting Recording Workflow Design

## Goal

Build a project-local CLI workflow for macOS that:

- captures meeting audio to a temporary local file,
- transcribes the meeting with either a cloud or local provider,
- organizes the transcript into useful sections,
- ensures a Notion database exists, and
- saves one structured meeting entry per recording.

## Why This Design

The most reliable source of truth is a local audio file. The ChatGPT or Codex microphone UI is useful for short dictation, but it is not a dependable system boundary for long meetings because session duration, focus changes, and UI state are not under our control.

The workflow therefore centers on:

1. local audio capture,
2. hybrid transcription (OpenAI first when configured, local fallback available),
3. transcript organization, and
4. Notion persistence.

## Scope

### In Scope

- A Node.js CLI runnable in this repo
- macOS recording command generation using `ffmpeg` and `avfoundation`
- local-audio ingestion when the user already has a recording
- pluggable transcription providers
- a Notion integration that finds or creates a transcript database
- automatic page creation with structured sections
- unit tests for the core orchestration and transformations

### Out of Scope

- A GUI app
- streaming live transcription
- speaker diarization
- calendar integration
- direct automation of the ChatGPT/Codex microphone button

## Architecture

### Entry Point

`bin/meeting-recording.js`

Parses a small set of CLI flags and dispatches to the workflow.

### Core Modules

- `src/config.js`
  - Reads environment configuration and validates required values
- `src/recorder.js`
  - Builds a macOS `ffmpeg` recording command
  - Optionally records to a temporary `.m4a` file
- `src/transcription.js`
  - Chooses between `openai`, `local`, or `auto`
  - Supports OpenAI audio transcription
  - Supports a local shell command template for offline transcription
- `src/transcript.js`
  - Normalizes raw transcript text
  - Produces structured sections: summary, key decisions, action items, full transcript
  - Uses OpenAI summarization when available, otherwise a deterministic fallback
- `src/notion.js`
  - Searches for a transcript database by title
  - Creates the database if missing
  - Creates one page per meeting and appends section blocks
- `src/workflow.js`
  - Orchestrates record/ingest -> transcribe -> organize -> save to Notion

## Notion Model

Database title: `Meeting Transcripts` by default

Properties:

- `Name` (title)
- `Meeting Date` (date)
- `Source` (select)
- `Status` (select)

The detailed content is stored in page blocks to avoid property length limits:

- `Summary`
- `Key Decisions`
- `Action Items`
- `Full Transcript`

## Configuration

Environment variables:

- `NOTION_TOKEN`
- `NOTION_PARENT_PAGE_ID`
- `NOTION_DATABASE_TITLE` (optional)
- `OPENAI_API_KEY` (optional for cloud mode)
- `OPENAI_TRANSCRIPTION_MODEL` (optional)
- `OPENAI_SUMMARY_MODEL` (optional)
- `TRANSCRIPTION_MODE` = `auto|openai|local`
- `LOCAL_TRANSCRIBE_COMMAND` (optional; use `{input}` placeholder)
- `RECORDING_DEVICE` (optional; default `:0`)
- `RECORDING_DURATION_SEC` (optional)
- `RECORDINGS_DIR` (optional; default `.recordings`)

## Error Handling

- Fail early if Notion is requested but required credentials are missing
- Fail clearly if `ffmpeg` is not installed when recording is requested
- Fail if transcription returns empty text
- Preserve the local audio file on error for retry/debugging
- Return deterministic messages for unit-testable failures

## Testing Strategy

Unit tests cover:

- config validation
- recording command construction
- transcript section generation
- Notion block construction
- workflow orchestration with mocked recorder, transcription provider, and Notion client

## Implementation Decision

Use a small CommonJS Node project with no third-party runtime dependencies so the workflow can run in a clean environment and the tests can execute with the built-in `node:test` runner.
