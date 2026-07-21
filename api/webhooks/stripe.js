import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Newer Stripe API versions moved current_period_start/end off the
// subscription object and onto its first item. The installed stripe npm
// package pins the account to an older API version unless overridden, so
// fall back to the subscription-level fields when the item doesn't have them.
function getPeriodDates(subscription) {
  const item = subscription.items?.data?.[0];
  const start = item?.current_period_start ?? subscription.current_period_start;
  const end = item?.current_period_end ?? subscription.current_period_end;
  return {
    current_period_start: start ? new Date(start * 1000).toISOString() : null,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
  };
}

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const { error } = await supabase.from('subscriptions').upsert({
          user_id: session.metadata.user_id,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          plan: session.metadata.plan || 'monthly',
          status: 'active',
          ...getPeriodDates(subscription),
        }, { onConflict: 'stripe_subscription_id' });
        if (error) throw error;
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const { error } = await supabase.from('subscriptions').update({
          status: subscription.status,
          ...getPeriodDates(subscription),
        }).eq('stripe_subscription_id', subscription.id);
        if (error) throw error;
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const { error } = await supabase.from('subscriptions').update({ status: 'canceled' })
          .eq('stripe_subscription_id', subscription.id);
        if (error) throw error;
        break;
      }
    }
    res.json({ received: true });
  } catch (error) {
    console.error(`Webhook handler failed for event ${event.type} (${event.id}):`, error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}