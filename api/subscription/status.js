import { createClient } from '@supabase/supabase-js';
import { clerkClient } from '@clerk/clerk-sdk-node';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const session = await clerkClient.verifyToken(token);
    const clerkUserId = session.sub;

    let { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (userError && userError.code === 'PGRST116') {
      const { data: newUser } = await supabase
        .from('users')
        .insert({ clerk_user_id: clerkUserId })
        .select()
        .single();
      user = newUser;
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: conversionsUsed } = await supabase
      .from('conversions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth.toISOString());

    res.status(200).json({
      subscribed: !!subscription,
      plan: subscription?.plan || null,
      status: subscription?.status || null,
      stripeCustomerId: subscription?.stripe_customer_id || null,
      conversionsUsed: conversionsUsed || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
