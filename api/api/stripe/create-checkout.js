import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { clerkClient } from '@clerk/clerk-sdk-node';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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
    const clerkUser = await clerkClient.users.getUser(clerkUserId);

    const { priceId, successUrl, cancelUrl } = req.body;

    // Get or create user
    let { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (!user) {
      const { data: newUser } = await supabase
        .from('users')
        .insert({ 
          clerk_user_id: clerkUserId,
          email: clerkUser.emailAddresses[0]?.emailAddress
        })
        .select()
        .single();
      user = newUser;
    }

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: clerkUser.emailAddresses[0]?.emailAddress,
      client_reference_id: user.id,
      metadata: {
        clerk_user_id: clerkUserId,
        user_id: user.id,
      },
    });

    res.status(200).json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}