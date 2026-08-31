import Anthropic from '@anthropic-ai/sdk';
import { clerkClient } from '@clerk/clerk-sdk-node';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You transcribe document page images into plain text with embedded LaTeX math notation. Output ONLY the transcribed content - no preamble, no explanation, no markdown code fences, no commentary.`;

const USER_PROMPT = `Transcribe this page's content exactly, top to bottom, in reading order.

Rules:
- Regular prose or notes: output as plain text, preserving paragraph and line breaks.
- Mathematical expressions, equations, and formulas: output using LaTeX math syntax. Wrap inline math in single dollar signs ($...$) and standalone/display equations in double dollar signs ($$...$$).
- Preserve structure (headings, numbered/bulleted items) using plain text.
- Do not add any commentary, labels, or explanation - output only the transcribed page content.
- If the page is blank or unreadable, output nothing.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    await clerkClient.verifyToken(token);

    const { imageBase64 } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: imageBase64 }
            },
            { type: 'text', text: USER_PROMPT }
          ]
        }
      ]
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    res.status(200).json({ text: textBlock?.text || '' });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('Anthropic auth error:', error.message);
      return res.status(500).json({ error: 'Transcription service misconfigured' });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Rate limited, please try again shortly' });
    }
    if (error instanceof Anthropic.APIError) {
      console.error('Anthropic API error:', error.status, error.message);
      return res.status(502).json({ error: 'Transcription service error' });
    }
    console.error('Page transcription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
