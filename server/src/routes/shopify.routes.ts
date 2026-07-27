import { Router } from "express";
import crypto from "crypto";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { getShopifyForTeam, invalidateShopifyForTeam } from "../services/shopify.service.js";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { connection as redisConnection } from "../services/queue.service.js";

export const shopifyRouter: Router = Router();

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

  const callerId = req.user!.sub;
  const supabase = getSupabaseAdmin();

  // Only team owner can save API credentials
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", callerId)
    .maybeSingle();

  if (!membership || membership.role !== "owner") {
    return res.status(403).json({ error: "Nur Team-Owner können Shopify-Anmeldeinformationen speichern" });
  }
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

shopifyRouter.get("/auth", async (req, res) => {
  const shop = req.query.shop as string;
  const teamId = req.query.team_id as string;

  if (!shop || !teamId) {
    return res.status(400).json({ error: "Missing shop or team_id" });
  }

  const shopify = await getShopifyForTeam(teamId);
  if (!shopify) {
    return res.status(400).json({ error: "Shopify app not configured for this team. Save API credentials first." });
  }

  try {
    await redisConnection.setex(`shopify_oauth:${shop}`, 900, teamId);
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
  const shop = req.query.shop as string;
  if (!shop) {
    return res.status(400).send("Missing shop parameter");
  }

  const teamId = await redisConnection.get(`shopify_oauth:${shop}`);
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
      let primaryDomain: string | null = null;
      try {
        const gqlRes = await fetch(`https://${session.shop}/admin/api/2025-04/graphql.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": session.accessToken,
          },
          body: JSON.stringify({ query: "{ shop { primaryDomain { host } } }" }),
        });
        const gqlJson = await gqlRes.json();
        primaryDomain = gqlJson.data?.shop?.primaryDomain?.host || null;
      } catch (e) {
        console.log("[Shopify OAuth] Could not resolve primary domain:", (e as Error).message);
      }

      const supabase = getSupabaseAdmin();
      await supabase.from("shopify_connections").upsert({
        team_id: teamId,
        shop_domain: session.shop,
        access_token: session.accessToken,
        scopes: session.scope,
        primary_domain: primaryDomain,
      }, { onConflict: "team_id,shop_domain" });
    }

    await redisConnection.del(`shopify_oauth:${shop}`);

    const frontendUrl = process.env.FRONTEND_URL || "https://mail.tim-regener.com";
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
  const rawEmail = req.query.email as string;
  const teamId = req.query.team_id as string;

  if (!rawEmail || !teamId) {
    return res.status(400).json({ error: "Missing email or team_id" });
  }

  // Extract actual email from "Name <email>" format
  const emailMatch = rawEmail.match(/<([^>]+)>/) || [null, rawEmail];
  const email = emailMatch[1]!;

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

    const gqlQuery = `
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
              numberOfOrders
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

    const apiRes = await fetch(`https://${connection.shop_domain}/admin/api/2025-04/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": connection.access_token,
      },
      body: JSON.stringify({ query: gqlQuery, variables: { email: `email:${email}` } }),
    });

    const apiJson = await apiRes.json();
    const customerData = apiJson?.data?.customers?.edges?.[0]?.node;

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
// Fetch Order Detail
// ---------------------------------------------------------------------------
shopifyRouter.get("/order/detail", requireAuth, async (req, res) => {
  const orderId = req.query.order_id as string;
  const teamId = req.query.team_id as string;

  if (!orderId || !teamId) {
    return res.status(400).json({ error: "Missing order_id or team_id" });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: connection } = await supabase
      .from("shopify_connections")
      .select("*")
      .eq("team_id", teamId)
      .limit(1)
      .maybeSingle();

    if (!connection) {
      return res.status(404).json({ error: "No Shopify connection found for this team" });
    }

    const gqlQuery = `
      query getOrder($id: ID!) {
        order(id: $id) {
          id
          name
          createdAt
          updatedAt
          processedAt
          cancelReason
          cancelledAt
          note
          tags
          email
          phone
          displayFinancialStatus
          displayFulfillmentStatus
          currencyCode
          test
          subtotalPriceSet { shopMoney { amount currencyCode } }
          totalTaxSet { shopMoney { amount currencyCode } }
          totalDiscountsSet { shopMoney { amount currencyCode } }
          totalShippingPriceSet { shopMoney { amount currencyCode } }
          totalPriceSet { shopMoney { amount currencyCode } }
          totalRefundedSet { shopMoney { amount currencyCode } }
          shippingAddress {
            firstName lastName company address1 address2 city province provinceCode zip countryCodeV2 country phone formatted
          }
          billingAddress {
            firstName lastName company address1 address2 city province provinceCode zip countryCodeV2 country phone formatted
          }
          shippingLine {
            title
            originalPriceSet { shopMoney { amount currencyCode } }
          }
          discountCodes
          lineItems(first: 50) {
            nodes {
              id
              title
              variantTitle
              sku
              quantity
              originalUnitPriceSet { shopMoney { amount currencyCode } }
              discountedUnitPriceSet { shopMoney { amount currencyCode } }
              totalDiscountSet { shopMoney { amount currencyCode } }
              image { url altText width height }
              product {
                id
                title
                handle
              }
              variant {
                id
                title
                sku
                price
                compareAtPrice
              }
            }
          }
        }
      }
    `;

    const apiRes = await fetch(`https://${connection.shop_domain}/admin/api/2025-04/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": connection.access_token,
      },
      body: JSON.stringify({ query: gqlQuery, variables: { id: orderId } }),
    });

    const apiJson = await apiRes.json();
    const order = apiJson?.data?.order;

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      shopDomain: connection.shop_domain,
      order,
    });
  } catch (error) {
    console.error("Shopify Order Detail Error:", error);
    res.status(500).json({ error: "Failed to fetch order detail" });
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

    const apiRes = await fetch(`https://${connection.shop_domain}/admin/api/2025-04/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": connection.access_token,
      },
      body: JSON.stringify({ query: mutation, variables: { orderId } }),
    });

    const apiJson = await apiRes.json();
    const errors = apiJson?.data?.orderCancel?.orderCancelUserErrors;
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
// Update Order (note + shipping address)
// ---------------------------------------------------------------------------
shopifyRouter.post("/order/update", requireAuth, async (req, res) => {
  const { orderId, teamId, note, shippingAddress } = req.body;

  if (!orderId || !teamId) {
    return res.status(400).json({ error: "Missing orderId or teamId" });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: connection } = await supabase
      .from("shopify_connections")
      .select("*")
      .eq("team_id", teamId)
      .limit(1)
      .maybeSingle();

    if (!connection) {
      return res.status(404).json({ error: "No Shopify connection found" });
    }

    const input: any = { id: orderId };
    if (note !== undefined) input.note = note;
    if (shippingAddress) {
      input.shippingAddress = {
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        company: shippingAddress.company || null,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || null,
        city: shippingAddress.city,
        province: shippingAddress.province || null,
        zip: shippingAddress.zip,
        countryCode: shippingAddress.countryCode || "DE",
        phone: shippingAddress.phone || null,
      };
    }

    const mutation = `
      mutation orderUpdate($input: OrderInput!) {
        orderUpdate(input: $input) {
          order {
            id
            note
            shippingAddress {
              firstName lastName company address1 address2 city province zip countryCodeV2 country phone
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const apiRes = await fetch(`https://${connection.shop_domain}/admin/api/2025-04/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": connection.access_token,
      },
      body: JSON.stringify({ query: mutation, variables: { input } }),
    });

    const apiJson = await apiRes.json();
    const result = apiJson?.data?.orderUpdate;

    if (result?.userErrors?.length > 0) {
      return res.status(400).json({ error: result.userErrors[0].message });
    }

    res.json({ order: result?.order });
  } catch (error) {
    console.error("Shopify Order Update Error:", error);
    res.status(500).json({ error: "Failed to update order" });
  }
});

// ---------------------------------------------------------------------------
// Fetch Order Communication — all emails for a customer across all orders
// ---------------------------------------------------------------------------

shopifyRouter.get("/order-communication", async (req, res) => {
  const shopDomain = req.query.shop as string;
  const customerEmail = req.query.customerEmail as string;
  const orderId = req.query.orderId as string;
  const orderName = req.query.orderName as string;

  // Validate shop domain format to prevent enumeration
  if (!shopDomain || !/^[a-z0-9.-]+$/.test(shopDomain)) {
    return res.status(400).json({ error: "Invalid shop domain" });
  }

  // Shared secret check — Shopify CDN strips custom headers, so accept header OR query param.
  // CORS already restricts callers to *.shopifycdn.com / *.myshopify.com.
  const extensionKey = (req.headers["x-teammail-extension-key"] as string) || (req.query.key as string);
  const expectedKey = process.env.SHOPIFY_EXTENSION_SECRET;
  if (expectedKey && extensionKey && extensionKey !== expectedKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("[OrderComm] Request:", { shopDomain, customerEmail, orderId, orderName });

  if (!customerEmail && !orderId && !orderName) {
    return res.status(400).json({ error: "Missing customerEmail, orderId, or orderName" });
  }

  try {
    const supabase = getSupabaseAdmin();
    let { data: connection } = await supabase
      .from("shopify_connections")
      .select("team_id, access_token, shop_domain")
      .eq("shop_domain", shopDomain)
      .single();

    if (!connection) {
      const { data: byPrimary } = await supabase
        .from("shopify_connections")
        .select("team_id, access_token, shop_domain")
        .eq("primary_domain", shopDomain)
        .single();
      connection = byPrimary;
    }

    if (!connection) {
      return res.status(404).json({ error: "Shop not connected" });
    }

    let resolvedEmail = customerEmail;

    // If only orderId provided, resolve customer email via Shopify API (with timeout)
    if (!resolvedEmail && orderId) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const gqlRes = await fetch(`https://${connection.shop_domain}/admin/api/2025-04/graphql.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": connection.access_token,
          },
          body: JSON.stringify({
            query: `{ order(id: "${orderId}") { email customer { email } } }`,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const gqlJson = await gqlRes.json();
        resolvedEmail = gqlJson.data?.order?.customer?.email || gqlJson.data?.order?.email;
      } catch (e) {
        console.log("[OrderComm] Shopify GQL skipped, using fallback:", (e as Error).message);
      }
    }

    // Search by email if available
    let emails: any[] = [];
    if (resolvedEmail) {
      const emailLower = resolvedEmail.toLowerCase().trim();
      const { data, error } = await supabase
        .from("emails")
        .select("id, subject, from_address, to_addresses, body_text, direction, received_at, status")
        .eq("team_id", connection.team_id)
        .or(`from_address.ilike.%${emailLower}%,to_addresses.cs.{${resolvedEmail}}`)
        .order("received_at", { ascending: false })
        .limit(20);
      if (!error) emails = data || [];
    }

    // Fallback: if no emails found or no email resolved, search by order name in subject
    if (emails.length === 0 && orderName) {
      const { data, error } = await supabase
        .from("emails")
        .select("id, subject, from_address, to_addresses, body_text, direction, received_at, status")
        .eq("team_id", connection.team_id)
        .ilike("subject", `%${orderName}%`)
        .order("received_at", { ascending: false })
        .limit(20);
      if (!error) emails = data || [];
    }

    res.json({ emails, customerEmail: resolvedEmail || null });
  } catch (error) {
    console.error("Shopify Order Communication Error:", error);
    res.status(500).json({ error: "Failed to fetch order communication" });
  }
});

// ---------------------------------------------------------------------------
// Auto-Sync: Push email note to matching Shopify orders
// ---------------------------------------------------------------------------

export async function syncEmailToShopifyOrders(opts: {
  teamId: string;
  customerEmail: string;
  subject: string;
  direction: "inbound" | "outbound";
  fromAddress: string;
  snippet: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: connection } = await supabase
      .from("shopify_connections")
      .select("*")
      .eq("team_id", opts.teamId)
      .limit(1)
      .maybeSingle();

    if (!connection) return;

    const dirLabel = opts.direction === "inbound" ? "Eingehend" : "Ausgehend";
    const noteLine = `[TeamMail ${dirLabel}] ${opts.fromAddress} → ${opts.customerEmail}\nBetreff: ${opts.subject}\n${opts.snippet.substring(0, 200)}`;

    const token = connection.access_token;
    const shop = connection.shop_domain;

    const ordersRes = await fetch(`https://${shop}/admin/api/2025-04/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({
        query: `query ($query: String!) {
          orders(first: 10, query: $query) {
            edges {
              node {
                id
                note
              }
            }
          }
        }`,
        variables: { query: `email:${opts.customerEmail}` },
      }),
    });

    const ordersJson = await ordersRes.json();
    const edges = ordersJson?.data?.orders?.edges || [];

    for (const { node: order } of edges) {
      const existingNote = order.note || "";
      const newNote = existingNote ? `${existingNote}\n\n${noteLine}` : noteLine;

      await fetch(`https://${shop}/admin/api/2025-04/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({
          query: `mutation orderUpdate($input: OrderInput!) {
            orderUpdate(input: $input) { order { id note } userErrors { field message } }
          }`,
          variables: { input: { id: order.id, note: newNote } },
        }),
      });
    }
  } catch (err) {
    console.error("[Shopify Auto-Sync] Error:", err);
  }
}
