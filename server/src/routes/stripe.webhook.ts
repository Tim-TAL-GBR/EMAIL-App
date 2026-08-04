import express, { Router } from "express";
import Stripe from "stripe";
import { supabaseServiceRole } from "../lib/supabase.js";
import { mailManager } from "../mail/MailManager.js";

export const stripeWebhookRouter = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

// Note: express.raw() is used here because Stripe requires the raw request body to verify the signature
stripeWebhookRouter.post("/", express.raw({ type: 'application/json' }), async (request, response) => {
  const sig = request.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig as string, endpointSecret);
  } catch (err: any) {
    console.error(`[stripe] Webhook Error: ${err.message}`);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.client_reference_id;
        if (orgId) {
          await supabaseServiceRole
            .from('subscriptions')
            .upsert({
              org_id: orgId,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              status: 'active',
              plan: 'pro'
            }, { onConflict: 'org_id' });
          
          await mailManager.restartClientsForOrg(orgId);
        }
        break;
      }
      
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Find org by customer ID
        const { data: orgSub } = await supabaseServiceRole
          .from('subscriptions')
          .select('org_id')
          .eq('stripe_customer_id', subscription.customer as string)
          .single();

        if (orgSub) {
          await supabaseServiceRole
            .from('subscriptions')
            .update({
              status: subscription.status,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
              stripe_subscription_id: subscription.id
            })
            .eq('org_id', orgSub.org_id);

          if (subscription.status === 'active' || subscription.status === 'trialing') {
            await mailManager.restartClientsForOrg(orgSub.org_id);
          } else {
            // past_due, canceled, unpaid -> stop IMAP sync
            await mailManager.stopClientsForOrg(orgSub.org_id);
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        
        const { data: orgSub } = await supabaseServiceRole
          .from('subscriptions')
          .select('org_id')
          .eq('stripe_customer_id', invoice.customer as string)
          .single();

        if (orgSub) {
          await supabaseServiceRole
            .from('billing_history')
            .insert({
              org_id: orgSub.org_id,
              stripe_invoice_id: invoice.id,
              amount_paid: invoice.amount_paid,
              currency: invoice.currency,
              status: 'paid',
              invoice_pdf: invoice.invoice_pdf
            });
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    response.send();
  } catch (error) {
    console.error(`[stripe] Webhook processing failed:`, error);
    response.status(500).send('Webhook processing failed');
  }
});
