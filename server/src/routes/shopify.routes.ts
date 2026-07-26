import { Router } from "express";
import { shopify } from "../shopify.js";
import { supabaseService } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

export const shopifyRouter = Router();

// OAuth: Begin
shopifyRouter.get("/auth", requireAuth, async (req, res) => {
  const shop = req.query.shop as string;
  const teamId = req.query.team_id as string;
  
  if (!shop || !teamId) {
    return res.status(400).send("Missing shop or team_id");
  }

  // Store teamId in a secure cookie to use it during the callback
  res.cookie("shopify_team_id", teamId, { 
    signed: false, 
    httpOnly: true, 
    maxAge: 1000 * 60 * 15 // 15 minutes
  });

  try {
    await shopify.auth.begin({
      shop: shopify.utils.sanitizeShop(shop, true)!,
      callbackPath: "/api/shopify/auth/callback",
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });
  } catch (error) {
    console.error("Shopify OAuth begin error", error);
    res.status(500).send("Error beginning OAuth flow");
  }
});

// OAuth: Callback
shopifyRouter.get("/auth/callback", async (req, res) => {
  try {
    const callbackResponse = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const session = callbackResponse.session;
    const teamId = req.cookies?.shopify_team_id;

    if (!teamId) {
      return res.status(400).send("Session expired or missing team_id");
    }

    if (session.accessToken) {
      // Upsert into shopify_connections
      await supabaseService.from("shopify_connections").upsert({
        team_id: teamId,
        shop_domain: session.shop,
        access_token: session.accessToken,
        scopes: session.scope
      }, { onConflict: "team_id" });
    }

    // Clear cookie
    res.clearCookie("shopify_team_id");
    
    // Redirect back to frontend settings
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8081";
    res.redirect(`${frontendUrl}/settings/integrations?shopify_success=true`);
  } catch (error) {
    console.error("Shopify OAuth callback error", error);
    res.status(500).send("Error during OAuth callback");
  }
});

// Fetch Customer & Orders
shopifyRouter.get("/customer", requireAuth, async (req, res) => {
  const email = req.query.email as string;
  const teamId = req.query.team_id as string;

  if (!email || !teamId) {
    return res.status(400).json({ error: "Missing email or team_id" });
  }

  try {
    // 1. Get Shopify connection for team
    const { data: connection } = await supabaseService
      .from("shopify_connections")
      .select("*")
      .eq("team_id", teamId)
      .single();

    if (!connection) {
      return res.status(404).json({ error: "No Shopify connection found for this team" });
    }

    const client = new shopify.clients.Graphql({
      session: {
        shop: connection.shop_domain,
        accessToken: connection.access_token,
        isOnline: false
      } as any
    });

    // 2. Query Shopify GraphQL for customer by email
    const query = `
      query getCustomer($email: String!) {
        customers(first: 1, query: $email) {
          edges {
            node {
              id
              firstName
              lastName
              email
              amountSpent {
                amount
                currencyCode
              }
              ordersCount
              orders(first: 5, sortKey: CREATED_AT, reverse: true) {
                edges {
                  node {
                    id
                    name
                    createdAt
                    displayFinancialStatus
                    displayFulfillmentStatus
                    totalPriceSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    const response = await client.request(query, {
      variables: { email: `email:${email}` }
    });

    const customerData = (response.data as any)?.customers?.edges?.[0]?.node;

    if (!customerData) {
      return res.json({ customer: null });
    }

    res.json({
      shopDomain: connection.shop_domain,
      customer: customerData
    });

  } catch (error) {
    console.error("Shopify API Error:", error);
    res.status(500).json({ error: "Failed to fetch from Shopify" });
  }
});

// Cancel Order
shopifyRouter.post("/order/cancel", requireAuth, async (req, res) => {
  const { orderId, teamId } = req.body;

  if (!orderId || !teamId) {
    return res.status(400).json({ error: "Missing orderId or teamId" });
  }

  try {
    const { data: connection } = await supabaseService
      .from("shopify_connections")
      .select("*")
      .eq("team_id", teamId)
      .single();

    if (!connection) {
      return res.status(404).json({ error: "No Shopify connection found for this team" });
    }

    const client = new shopify.clients.Graphql({
      session: {
        shop: connection.shop_domain,
        accessToken: connection.access_token,
        isOnline: false
      } as any
    });

    const mutation = `
      mutation orderCancel($orderId: ID!) {
        orderCancel(orderId: $orderId) {
          job {
            id
          }
          orderCancelUserErrors {
            code
            field
            message
          }
        }
      }
    `;

    const response = await client.request(mutation, {
      variables: { orderId }
    });

    const errors = (response.data as any)?.orderCancel?.orderCancelUserErrors;
    if (errors && errors.length > 0) {
      return res.status(400).json({ error: errors[0].message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Shopify Cancel Order Error:", error);
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

// Fetch Order Communication
shopifyRouter.get("/order-communication", async (req, res) => {
  const shopDomain = req.query.shop as string;
  const orderName = req.query.orderName as string;

  if (!shopDomain || !orderName) {
    return res.status(400).json({ error: "Missing shop or orderName" });
  }

  try {
    // 1. Get Shopify connection
    const { data: connection } = await supabaseService
      .from("shopify_connections")
      .select("team_id")
      .eq("shop_domain", shopDomain)
      .single();

    if (!connection) {
      return res.status(404).json({ error: "Shop not connected" });
    }

    // 2. Fetch emails for this team that have orderName in the subject
    const { data: emails, error } = await supabaseService
      .from("emails")
      .select("*")
      .eq("team_id", connection.team_id)
      .ilike("subject", `%${orderName}%`)
      .order("received_at", { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ emails: emails || [] });
  } catch (error) {
    console.error("Shopify Order Communication Error:", error);
    res.status(500).json({ error: "Failed to fetch order communication" });
  }
});
