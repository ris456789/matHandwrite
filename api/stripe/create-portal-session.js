const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const { clerkClient } = require("@clerk/clerk-sdk-node");

// Make sure this is your LIVE secret key in Vercel env vars
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  // Allow only POST
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const session = await clerkClient.verifyToken(token);
    const clerkUserId = session.sub;

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .single();

    if (userError) throw userError;

    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) throw subError;

    if (!subscription?.stripe_customer_id) {
      return res.status(404).json({ error: "No subscription found for this account" });
    }

    // Create a Stripe Billing Portal session for the authenticated user's own customer id
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: "https://www.mathandwrite.com", // where to send them back after managing billing
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (err) {
    console.error("Error creating billing portal session:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
