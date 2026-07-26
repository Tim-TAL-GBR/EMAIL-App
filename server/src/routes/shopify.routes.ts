import { Router } from "express";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { getShopifyForTeam, invalidateShopifyForTeam } from "../services/shopify.service.js";
import { requireAuth } from "../middleware/expressAuth.middleware.js";

export const shopifyRouter = Router();

// ---------------------------------------------------------------------------
// App Configuration – save / retrieve per-team API credentials
// ---------------------------------------------------------------------------

shopifyRouter.get("/app-config", requireAuth, async (req, res) => {
  const teamId = req.query.team_id as string;
  if (!teamId) return res.status(400).json({ error: "Missing team_id" });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("shopify_apps")
    .select("id, team_id, api_key, app_host_name, created_at")
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ config: data });
});

shopifyRouter.post("/app-config", requireAuth, async (req, res) => {
  const { teamId, apiKey, apiSecret, appHostName } = req.body;
  if (!teamId || !apiKey || !apiSecret) {
    return res.status(400).json({ error: "Missing teamId, apiKey, or apiSecret" });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("shopify_apps")
    .upsert({
      team_id: teamId,
      api_key: apiKey,
      api_secret: apiSecret,
      app_host_name: appHostName || null,
    }, { onConflict: "team_id" })
    .select("id, team_id, api_key, app_host_name")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  invalidateShopifyForTeam(teamId);
  res.json({ config: data });
});

// ---------------------------------------------------------------------------
// Connection Status – list connected shops for a team
// ---------------------------------------------------------------------------

shopifyRouter.get("/status", requireAuth, async (req, res) => {
  const teamId = req.query.team_id as string;
  if (!teamId) return res.status(400).json({ error: "Missing team_id" });

  const supabase = getSupabaseAdmin();

  const [{ data: appConfig }, { data: shops }] = await Promise.all([
    supabase.from("shopify_apps").select("api_key, app_host_name").eq("team_id", teamId).maybeSingle(),
    supabase.from("shopify_connections").select("shop_domain, created_at").eq("team_id", teamId).order("created_at", { ascending: false }),
  ]);

  res.json({
    configured: !!appConfig,
    appHostName: appConfig?.app_host_name || null,
    shops: shops || [],
  });
});

// ---------------------------------------------------------------------------
// OAuth: Begin
// ---------------------------------------------------------------------------

shopifyRouter.get("/auth", requireAuth, async (req, res) => {
  const shop = req.query.shop as string;
  const teamId = req.query.team_id as string;

  if (!shop || !teamId) {
    return res.status(400).json({ error: "Missing shop or team_id" });
  }

  const shopify = await getShopifyForTeam(teamId);
  if (!shopify) {
    return res.status(400).json({ error: "Shopify app not configured for this team. Save API credentials first." });
  }

  res.cookie("shopify_team_id", teamId, {
    signed: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 15,
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
    res.status(500).json({ error: "Error beginning OAuth flow" });
  }
});

// ---------------------------------------------------------------------------
// OAuth: Callback
// ---------------------------------------------------------------------------

shopifyRouter.get("/auth/callback", async (req, res) => {
  const teamId = req.cookies?.shopify_team_id;
  if (!teamId) {
    return res.status(400).send("Session expired or missing team_id");
  }

  const shopify = await getShopifyForTeam(teamId);
  if (!shopify) {
    return res.status(400).send("Shopify app not configured for this team");
  }

  try {
    const callbackResponse = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const session = callbackResponse.session;

    if (session.accessToken) {
      const supabase = getSupabaseAdmin();
      await supabase.from("shopify_connections").upsert({
        team_id: teamId,
        shop_domain: session.shop,
        access_token: session.accessToken,
        scopes: session.scope,
      }, { onConflict: "team_id,shop_domain" });
    }

    res.clearCookie("shopify_team_id");

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8081";
    res.redirect(`${frontendUrl}/settings/integrations?shopify_success=true`);
  } catch (error) {
    console.error("Shopify OAuth callback error", error);
    res.status(500).send("Error during OAuth callback");
  }
});

// ---------------------------------------------------------------------------
// Disconnect – remove a connected shop
// ---------------------------------------------------------------------------

shopifyRouter.delete("/disconnect", requireAuth, async (req, res) => {
  const { teamId, shopDomain } = req.body;
  if (!teamId || !shopDomain) {
    return res.status(400).json({ error: "Missing teamId or shopDomain" });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("shopify_connections")
    .delete()
    .eq("team_id", teamId)
    .eq("shop_domain", shopDomain);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Fetch Customer & Orders
// ---------------------------------------------------------------------------

shopifyRouter.get("/customer", requireAuth, async (req, res) => {
  const email = req.query.email as string;
  const teamId = req.query.team_id as string;

  if (!email || !teamId) {
    return res.status(400).json({ error: "Missing email or team_id" });
  }

  try {
    const shopify = await getShopifyForTeam(teamId);
    if (!shopify) {
      return res.status(404).json({ error: "No Shopify app configured for this team" });
    }

    const supabase = getSupabaseAdmin();
    const { data: connection } = await supabase
      .from("shopify_connections")
      .select("*")
      .eq("team_id", teamId)
      .eq("shop_domain", req.query.shop as string)
      .maybeSingle()
      .then(async (result) => {
        if (result.data) return result;
        const fallback = await supabase
          .from("shopify_connections")
          .select("*")
          .eq("team_id", teamId)
          .limit(1)
          .maybeSingle();
        return fallback;
      });

    if (!connection) {
      return res.status(404).json({ error: "No Shopify connection found for this team" });
    }

    const client = new shopify.clients.Graphql({
      session: {
        shop: connection.shop_domain,
        accessToken: connection.access_token,
        isOnline: false,
      } as any,
    });

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
      variables: { email: `email:${email}` },
    });

    const customerData = (response.data as any)?.customers?.edges?.[0]?.node;

    if (!customerData) {
      return res.json({ customer: null });
    }

    res.json({
      shopDomain: connection.shop_domain,
      customer: customerData,
    });
  } catch (error) {
    console.error("Shopify API Error:", error);
    res.status(500).json({ error: "Failed to fetch from Shopify" });
  }
});

// ---------------------------------------------------------------------------
// Cancel Order
// ---------------------------------------------------------------------------

shopifyRouter.post("/order/cancel", requireAuth, async (req, res) => {
  const { orderId, teamId, shopDomain } = req.body;

  if (!orderId || !teamId) {
    return res.status(400).json({ error: "Missing orderId or teamId" });
  }

  try {
    const shopify = await getShopifyForTeam(teamId);
    if (!shopify) {
      return res.status(404).json({ error: "No Shopify app configured for this team" });
    }

    const supabase = getSupabaseAdmin();
    let connectionQuery = supabase
      .from("shopify_connections")
      .select("*")
      .eq("team_id", teamId);
    if (shopDomain) {
      connectionQuery = connectionQuery.eq("shop_domain", shopDomain);
    }
    const { data: connection } = await connectionQuery.limit(1).single();

    if (!connection) {
      return res.status(404).json({ error: "No Shopify connection found for this team" });
    }

    const client = new shopify.clients.Graphql({
      session: {
        shop: connection.shop_domain,
        accessToken: connection.access_token,
        isOnline: false,
      } as any,
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
      variables: { orderId },
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

// ---------------------------------------------------------------------------
// Fetch Order Communication
// ---------------------------------------------------------------------------

shopifyRouter.get("/order-communication", requireAuth, async (req, res) => {
  const shopDomain = req.query.shop as string;
  const orderName = req.query.orderName as string;

  if (!shopDomain || !orderName) {
    return res.status(400).json({ error: "Missing shop or orderName" });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: connection } = await supabase
      .from("shopify_connections")
      .select("team_id")
      .eq("shop_domain", shopDomain)
      .single();

    if (!connection) {
      return res.status(404).json({ error: "Shop not connected" });
    }

    const { data: emails, error } = await supabase
      .from("emails")
      .select("*")
      .eq("inbox_id", connection.team_id)
      .ilike("subject", `%${orderName}%`)
      .order("received_at", { ascending: false });

    if (error) throw error;

    res.json({ emails: emails || [] });
  } catch (error) {
    console.error("Shopify Order Communication Error:", error);
    res.status(500).json({ error: "Failed to fetch order communication" });
  }
});
