-- CreateTable
CREATE TABLE "AssistPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Starting prompts. Deleting them does not bring them back.
INSERT INTO "AssistPrompt" ("id", "name", "body", "position", "createdAt", "updatedAt")
VALUES
    (
        'prompt_explain',
        'Explain',
        'Explain this passage in plain sentences. Unpack a term only when the passage uses it. Stay with the passage.

Title: {{title}}
Author: {{author}}

{{content}}',
        0,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'prompt_note',
        'Note',
        'Write a short note to keep beside this passage. Two or three sentences, and only what the passage says.

Title: {{title}}
Author: {{author}}

{{content}}',
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
