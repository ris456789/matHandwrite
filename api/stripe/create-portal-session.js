const Stripe = require("stripe");

// Make sure this is your LIVE secret key in Vercel env vars
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // Allow only POST
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { customerId } = body || {};

    if (!customerId) {
      return res.status(400).json({ error: "Missing Stripe customerId" });
    }

    // Create a Stripe Billing Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: "https://www.mathandwrite.com", // where to send them back after managing billing
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Error creating billing portal session:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
