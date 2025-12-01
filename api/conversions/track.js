import { createClient } from '@supabase/supabase-js';
import { clerkClient } from '@clerk/clerk-sdk-node';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const session = await clerkClient.verifyToken(token);
    const clerkUserId = session.sub;

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await supabase.from('conversions').insert({ user_id: user.id });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}