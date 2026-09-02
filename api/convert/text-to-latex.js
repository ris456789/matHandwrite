import Anthropic from '@anthropic-ai/sdk';
import { clerkClient } from '@clerk/clerk-sdk-node';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_INPUT_LENGTH = 20000;

const SYSTEM_PROMPT = `You are given text a student copy-pasted from an AI chat assistant (ChatGPT, Claude, or similar). When math is copied out of these tools it often arrives mangled - unicode math-alphanumeric letters instead of plain ones, equations split across stray line breaks, mixed \\( \\)/\\[ \\] delimiters, or symbols like ∑ ∫ √ ² left as raw unicode instead of LaTeX commands. Rewrite the input as plain text with clean, valid, consistent LaTeX math notation. Output ONLY the rewritten content - no preamble, no explanation, no markdown code fences, no commentary.

Rules:
- Preserve every word and every equation's meaning exactly - do not summarize, shorten, omit, paraphrase, or add anything that wasn't in the original.
- Wrap inline math in single dollar signs ($...$) and standalone/display equations in double dollar signs ($$...$$).
- Rebuild any mangled unicode math letters/symbols, broken line-wrapped equations, or \\( \\)/\\[ \\] delimiters into proper LaTeX commands inside the $ delimiters (e.g. subscripts as _{}, superscripts as ^{}, \\sum, \\int, \\infty, \\omega, \\sqrt{}, \\frac{}{}, etc.).
- Preserve paragraph breaks, headings, and list structure as plain text.
- If the input contains no math, just return the text unchanged.`;

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

    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.length > MAX_INPUT_LENGTH) {
      return res.status(400).json({ error: `text exceeds ${MAX_INPUT_LENGTH} character limit` });
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text }]
        }
      ]
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    res.status(200).json({ text: textBlock?.text || '' });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('Anthropic auth error:', error.message);
      return res.status(500).json({ error: 'Cleanup service misconfigured' });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Rate limited, please try again shortly' });
    }
    if (error instanceof Anthropic.APIError) {
      console.error('Anthropic API error:', error.status, error.message);
      return res.status(502).json({ error: 'Cleanup service error' });
    }
    console.error('Text-to-LaTeX cleanup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
