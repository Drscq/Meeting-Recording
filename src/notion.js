const { assertNotionConfig } = require("./config");
const { WorkflowError } = require("./errors");

const NOTION_VERSION = "2022-06-28";
const MAX_TEXT_CHARS = 1800;

function makeText(content) {
  return {
    type: "text",
    text: {
      content
    }
  };
}

function chunkText(value, maxLength = MAX_TEXT_CHARS) {
  const text = String(value || "");

  if (text.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  let cursor = 0;

  while (cursor < text.length) {
    chunks.push(text.slice(cursor, cursor + maxLength));
    cursor += maxLength;
  }

  return chunks;
}

function paragraphBlocks(value) {
  return chunkText(value).map((chunk) => ({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [makeText(chunk)]
    }
  }));
}

function bulletBlocks(items) {
  const safeItems = items.length > 0 ? items : ["None recorded."];

  return safeItems.flatMap((item) =>
    chunkText(item).map((chunk) => ({
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [makeText(chunk)]
      }
    }))
  );
}

function headingBlock(title) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [makeText(title)]
    }
  };
}

function buildTranscriptBlocks(sections) {
  return [
    headingBlock("Summary"),
    ...paragraphBlocks(sections.summary),
    headingBlock("Key Decisions"),
    ...bulletBlocks(sections.keyDecisions),
    headingBlock("Action Items"),
    ...bulletBlocks(sections.actionItems),
    headingBlock("Full Transcript"),
    ...paragraphBlocks(sections.fullTranscript)
  ];
}

function extractDatabaseTitle(database) {
  return (database.title || [])
    .map((part) => part.plain_text || part.text?.content || "")
    .join("")
    .trim();
}

function toDateString(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function buildMeetingPagePayload(options) {
  const { databaseId, title, meetingDate, source, sections } = options;

  return {
    parent: {
      database_id: databaseId
    },
    properties: {
      Name: {
        title: [makeText(title)]
      },
      "Meeting Date": {
        date: {
          start: toDateString(meetingDate)
        }
      },
      Source: {
        select: {
          name: source
        }
      },
      Status: {
        select: {
          name: "captured"
        }
      }
    },
    children: buildTranscriptBlocks(sections)
  };
}

function createNotionClient(options) {
  const { config, fetchImpl = global.fetch } = options;

  assertNotionConfig(config);

  if (typeof fetchImpl !== "function") {
    throw new WorkflowError("fetch is required for Notion integration.");
  }

  async function request(path, body) {
    const response = await fetchImpl(`https://api.notion.com/v1${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.notionToken}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new WorkflowError(`Notion request failed: ${response.status} ${detail}`);
    }

    return response.json();
  }

  async function searchDatabaseByTitle(title) {
    const payload = await request("/search", {
      query: title,
      filter: {
        property: "object",
        value: "database"
      }
    });

    return (
      payload.results.find(
        (result) => extractDatabaseTitle(result).toLowerCase() === title.toLowerCase()
      ) || null
    );
  }

  async function createDatabase(title) {
    return request("/databases", {
      parent: {
        type: "page_id",
        page_id: config.notionParentPageId
      },
      title: [makeText(title)],
      properties: {
        Name: {
          title: {}
        },
        "Meeting Date": {
          date: {}
        },
        Source: {
          select: {
            options: [
              { name: "microphone", color: "blue" },
              { name: "audio_file", color: "gray" },
              { name: "import", color: "green" }
            ]
          }
        },
        Status: {
          select: {
            options: [{ name: "captured", color: "green" }]
          }
        }
      }
    });
  }

  async function ensureDatabase(title = config.notionDatabaseTitle) {
    const existing = await searchDatabaseByTitle(title);
    return existing || createDatabase(title);
  }

  async function createMeetingPage(optionsForPage) {
    return request("/pages", buildMeetingPagePayload(optionsForPage));
  }

  async function saveMeeting(optionsForMeeting) {
    const database = await ensureDatabase();

    return createMeetingPage({
      databaseId: database.id,
      title: optionsForMeeting.title,
      meetingDate: optionsForMeeting.meetingDate,
      source: optionsForMeeting.source,
      sections: optionsForMeeting.sections
    });
  }

  return {
    createDatabase,
    createMeetingPage,
    ensureDatabase,
    saveMeeting,
    searchDatabaseByTitle
  };
}

module.exports = {
  buildMeetingPagePayload,
  buildTranscriptBlocks,
  createNotionClient,
  extractDatabaseTitle
};

