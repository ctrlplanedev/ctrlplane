import type * as schema from "@ctrlplane/db/schema";
import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";

import { logger } from "@ctrlplane/logger";

import { env } from "~/env";
import { parseBody } from "../../body-parser";
import { request } from "../../middleware";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

const bodySchema = z.object({
  prompt: z.string(),
});

export const POST = request()
  // .use(authn)
  .use(parseBody(bodySchema))
  .handle<{ user: schema.User; body: z.infer<typeof bodySchema> }>(
    async (ctx) => {
      const { body } = ctx;

      try {
        console.log(
          `Processing AI command request with prompt: ${body.prompt}`,
        );

        if (!env.OPENAI_API_KEY) {
          logger.error("OPENAI_API_KEY environment variable is not set");
          return NextResponse.json(
            { error: "OPENAI_API_KEY is not set" },
            { status: 500 },
          );
        }

        logger.info("Streaming text from OpenAI...");
        const { text } = await generateText({
          model: openai("gpt-4-turbo"),
          messages: [
            {
              role: "system",
              content:
                "You are a command-line assistant. You must ALWAYS return ONLY a valid shell command, with no explanation or additional text. " +
                "If the user's request cannot be directly translated to a shell command, generate the most relevant shell command that could help. " +
                "Never return plain text responses - only return executable shell commands. " +
                "Format: Return the raw command without backticks or any formatting.",
            },
            {
              role: "user",
              content: `Convert this request into a shell command (return ONLY the command):
              ${body.prompt}`,
            },
          ],
        });

        logger.info(`Generated command response: ${text}`);

        return NextResponse.json({
          text: text.trim().replace("`", ""),
        });
      } catch (error) {
        console.error("Error processing AI command request:", error);
        return NextResponse.json(
          { error: "Failed to process command request" },
          { status: 500 },
        );
      }
    },
  );
