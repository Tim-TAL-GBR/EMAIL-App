import { Router } from "express";
import { supabaseServiceRole } from "../lib/supabase.js";
import Stripe from "stripe";

export const billingRouter = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

// Middleware to ensure user is authenticated
billingRouter.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No authorization header" });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseServiceRole.auth.getUser(token);
  
  if (error || !user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  (req as any).user = user;
  next();
});

billingRouter.post("/create-checkout-session", async (req, res) => {
  try {
    const { orgId } = req.body;
    const user = (req as any).user;

    // Verify user is owner or admin of this org
    const { data: member, error: memberError } = await supabaseServiceRole
      .from('team_members')
      .select('role')
      .eq('team_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    // Get or create subscription record
    const { data: subscription } = await supabaseServiceRole
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('org_id', orgId)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { orgId }
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, // Your flat-rate price ID
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/settings/billing?canceled=true`,
      client_reference_id: orgId,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("[billing] checkout error:", error);
    res.status(500).json({ error: error.message });
  }
});

billingRouter.post("/customer-portal", async (req, res) => {
  try {
    const { orgId } = req.body;
    const user = (req as any).user;

    // Verify user is owner or admin
    const { data: member, error: memberError } = await supabaseServiceRole
      .from('team_members')
      .select('role')
      .eq('team_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const { data: subscription } = await supabaseServiceRole
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('org_id', orgId)
      .single();

    if (!subscription?.stripe_customer_id) {
      return res.status(404).json({ error: "No customer record found" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/settings/billing`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("[billing] portal error:", error);
    res.status(500).json({ error: error.message });
  }
});
