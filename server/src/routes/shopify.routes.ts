import { safeErrorMessage } from "../utils/errors.js";
import { Router } from "express";
import { getSupabaseAdmin } from "../services/auth.service.js";
import { getShopifyForTeam, invalidateShopifyForTeam } from "../services/shopify.service.js";
import { requireAuth } from "../middleware/expressAuth.middleware.js";
import { verifySupabaseToken } from "../middleware/auth.middleware.js";
import { connection as redisConnection } from "../services/queue.service.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { smtpClient } from "../mail/SmtpClient.js";
export const shopifyRouter: Router = Router();

// Decrypt access_token on a connection object (safe no-op if already plaintext)
function decryptConn<T extends { access_token?: string }>(conn: T | null): T | null {
  if (conn?.access_token) conn.access_token = decrypt(conn.access_token);
  return conn;
}

async function verifyShopifySessionToken(token: string, shopDomain: string): Promise<any> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error("Token expired");
  }

  const supabase = getSupabaseAdmin();
  let { data: conn } = await supabase
    .from("shopify_connections")
    .select("team_id")
    .eq("shop_domain", shopDomain)
    .maybeSingle();

  if (!conn) {
    conn = (await supabase
      .from("shopify_connections")
      .select("team_id")
      .eq("primary_domain", shopDomain)
      .maybeSingle()).data;
  }

  if (!conn) throw new Error("Shop not connected");

  const shopify = await getShopifyForTeam(conn.team_id);
  if (!shopify) throw new Error("Shopify app not configured");

  // Verify JWT signature and audience using Shopify's JWKS
  const decoded = await shopify.session.decodeSessionToken(token);

  // Verify issuer matches the shop domain
  const issShop = decoded.iss?.replace("https://", "").replace("/admin", "");
  if (!issShop || (shopDomain && issShop !== shopDomain && decoded.dest !== `https://${shopDomain}`)) {
    throw new Error("Token shop mismatch");
  }

  return { payload: decoded, teamId: conn.team_id };
}

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

  if (error) return res.status(500).json({ error: safeErrorMessage(error) });
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
      api_secret: encrypt(apiSecret),
      app_host_name: appHostName || null,
    }, { onConflict: "team_id" })
    .select("id, team_id, api_key, app_host_name")
    .single();

  if (error) return res.status(500).json({ error: safeErrorMessage(error) });
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
  const token = req.query.token as string;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const payload = await verifySupabaseToken(authHeader.slice(7));
      if (payload?.sub) req.user = payload;
    }
  } else {
    const payload = await verifySupabaseToken(token);
    if (payload?.sub) req.user = payload;
  }

  if (!req.user?.sub) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!shop || !teamId) {
    return res.status(400).json({ error: "Missing shop or team_id" });
  }

  // Verify caller is owner/admin of this team
  const supabase = getSupabaseAdmin();
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", req.user!.sub)
    .maybeSingle();

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return res.status(403).json({ error: "Only team owners/admins can initiate Shopify OAuth" });
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
        const gqlRes = await fetch(`https://${session.shop}/admin/api/2025-10/graphql.json`, {
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
        access_token: encrypt(session.accessToken),
        scopes: session.scope,
        primary_domain: primaryDomain,
      }, { onConflict: "team_id,shop_domain" });
    }

    await redisConnection.del(`shopify_oauth:${shop}`);

    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      console.error("[Shopify OAuth] FRONTEND_URL is not set");
    }
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
  console.log("[Disconnect] req.body:", JSON.stringify(req.body), "req.headers.content-type:", req.headers["content-type"]);
  if (!teamId || !shopDomain) {
    return res.status(400).json({ error: "Missing teamId or shopDomain" });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("shopify_connections")
    .delete()
    .eq("team_id", teamId)
    .eq("shop_domain", shopDomain);

  if (error) return res.status(500).json({ error: safeErrorMessage(error) });
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
    const { data: rawConnection } = await supabase
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
    const connection = decryptConn(rawConnection);

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
            }
          }
        }
      }
    `;

    const ordersQuery = `
      query getOrdersByEmail($query: String!) {
        orders(first: 5, query: $query, sortKey: CREATED_AT, reverse: true) {
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
    `;

    const apiRes = await fetch(`https://${connection.shop_domain}/admin/api/2025-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": connection.access_token,
      },
      body: JSON.stringify({ query: gqlQuery, variables: { email: `email:${email}` } }),
    });

    const apiJson = await apiRes.json();
    const customerData = apiJson?.data?.customers?.edges?.[0]?.node;

    // Fetch orders separately since Customer.orders often returns empty edges
    let orders = customerData?.numberOfOrders !== "0" ? [] : [];
    if (customerData && customerData.numberOfOrders !== "0") {
      const ordersRes = await fetch(`https://${connection.shop_domain}/admin/api/2025-10/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": connection.access_token,
        },
        body: JSON.stringify({ query: ordersQuery, variables: { query: `email:${email}` } }),
      });
      const ordersJson = await ordersRes.json();
      orders = ordersJson?.data?.orders?.edges || [];
    }

    // Merge orders into customer data structure
    if (customerData) {
      customerData.orders = { edges: orders };
    }

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
    const { data: rawConnection } = await supabase
      .from("shopify_connections")
      .select("*")
      .eq("team_id", teamId)
      .limit(1)
      .maybeSingle();
    const connection = decryptConn(rawConnection);

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
              currentQuantity
              refundableQuantity
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
          refunds {
            id
            createdAt
            totalRefundedSet { shopMoney { amount currencyCode } }
            refundLineItems(first: 50) {
              nodes {
                quantity
                subtotalSet { shopMoney { amount currencyCode } }
                lineItem {
                  id
                  title
                  variantTitle
                }
              }
            }
          }
        }
      }
    `;

    const apiRes = await fetch(`https://${connection.shop_domain}/admin/api/2025-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": connection.access_token,
      },
      body: JSON.stringify({ query: gqlQuery, variables: { id: orderId } }),
    });

    const apiJson = await apiRes.json();
    if (apiJson.errors && apiJson.errors.length > 0) {
      console.error("[Shopify] Order detail GraphQL errors:", JSON.stringify(apiJson.errors));
    }
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
    const { data: rawConnection } = await connectionQuery.limit(1).single();
    const connection = decryptConn(rawConnection);

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

    const apiRes = await fetch(`https://${connection.shop_domain}/admin/api/2025-10/graphql.json`, {
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
    const { data: rawConnection } = await supabase
      .from("shopify_connections")
      .select("*")
      .eq("team_id", teamId)
      .limit(1)
      .maybeSingle();
    const connection = decryptConn(rawConnection);

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

    const apiRes = await fetch(`https://${connection.shop_domain}/admin/api/2025-10/graphql.json`, {
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

  if (!shopDomain || !/^[a-z0-9.-]+$/.test(shopDomain)) {
    return res.status(400).json({ error: "Invalid shop domain" });
  }

  const authHeader = req.headers["authorization"] as string;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const sessionToken = authHeader.slice(7);
  let teamId: string;
  try {
    const result = await verifyShopifySessionToken(sessionToken, shopDomain);
    teamId = result.teamId;
  } catch (err: any) {
    return res.status(401).json({ error: err.message || "Invalid session token" });
  }

  console.log("[OrderComm] Request:", { shopDomain, customerEmail, orderId, orderName });

  if (!customerEmail && !orderId && !orderName) {
    return res.status(400).json({ error: "Missing customerEmail, orderId, or orderName" });
  }

  try {
    const supabase = getSupabaseAdmin();

    let resolvedEmail = customerEmail;

    // If only orderId provided, resolve customer email via Shopify API (with timeout)
    if (!resolvedEmail && orderId) {
      try {
        const { data: rawConnection } = await supabase
          .from("shopify_connections")
          .select("access_token, shop_domain")
          .eq("shop_domain", shopDomain)
          .single();
        const connection = decryptConn(rawConnection);
        if (connection?.access_token) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const gqlRes = await fetch(`https://${connection.shop_domain}/admin/api/2025-10/graphql.json`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": connection.access_token,
            },
            body: JSON.stringify({
              query: `query ($id: ID!) { order(id: $id) { email customer { email } } }`,
              variables: { id: orderId },
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          const gqlJson = await gqlRes.json();
          resolvedEmail = gqlJson.data?.order?.customer?.email || gqlJson.data?.order?.email;
          console.log("[OrderComm] GQL result:", { resolvedEmail, gqlErrors: gqlJson.errors });
        }
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
        .eq("team_id", teamId)
        .or(`from_address.ilike.%${emailLower}%,to_addresses.cs.{${resolvedEmail}}`)
        .order("received_at", { ascending: false })
        .limit(20);
      if (!error) emails = data || [];
      console.log("[OrderComm] Email search:", { resolvedEmail, count: emails.length, error });
    }

    // Fallback: if no emails found or no email resolved, search by order name in subject
    if (emails.length === 0 && orderName) {
      const { data, error } = await supabase
        .from("emails")
        .select("id, subject, from_address, to_addresses, body_text, direction, received_at, status")
        .eq("team_id", teamId)
        .ilike("subject", `%${orderName}%`)
        .order("received_at", { ascending: false })
        .limit(20);
      if (!error) emails = data || [];
    }

    console.log("[OrderComm] Response:", { emailCount: emails.length, resolvedEmail });
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.json({ emails, customerEmail: resolvedEmail || null });
  } catch (error) {
    console.error("Shopify Order Communication Error:", error);
    res.status(500).json({ error: "Failed to fetch order communication" });
  }
});

// ---------------------------------------------------------------------------
// Fetch Templates for Order Communication
// ---------------------------------------------------------------------------

shopifyRouter.get("/order-communication/templates", async (req, res) => {
  const shopDomain = req.query.shop as string;
  if (!shopDomain) return res.status(400).json({ error: "Missing shop parameter" });

  const authHeader = req.headers["authorization"] as string;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const sessionToken = authHeader.slice(7);
  let teamId: string;
  try {
    const result = await verifyShopifySessionToken(sessionToken, shopDomain);
    teamId = result.teamId;
  } catch (err: any) {
    return res.status(401).json({ error: err.message || "Invalid session token" });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: templates, error } = await supabase
      .from("templates")
      .select("*")
      .eq("team_id", teamId)
      .eq("scope", "team")
      .eq("show_in_shopify", true)
      .order("name");

    if (error) throw error;
    res.json({ templates: templates || [] });
  } catch (error) {
    console.error("Shopify Templates Fetch Error:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// ---------------------------------------------------------------------------
// Send Email from Order Communication
// ---------------------------------------------------------------------------

shopifyRouter.post("/order-communication/send", async (req, res) => {
  const { shopDomain, subject, to, bodyText, inReplyTo, references } = req.body;
  
  if (!shopDomain || !subject || !to || !bodyText) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const authHeader = req.headers["authorization"] as string;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const sessionToken = authHeader.slice(7);
  let teamId: string;
  try {
    const result = await verifyShopifySessionToken(sessionToken, shopDomain);
    teamId = result.teamId;
  } catch (err: any) {
    return res.status(401).json({ error: err.message || "Invalid session token" });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Find the default shared inbox for this team
    const { data: inboxes } = await supabase
      .from("inboxes")
      .select("id")
      .eq("team_id", teamId)
      .eq("type", "shared")
      .limit(1);

    if (!inboxes || inboxes.length === 0) {
      return res.status(400).json({ error: "No shared inbox configured for this team" });
    }
    
    const inboxId = inboxes[0].id;
    
    // Find the primary alias
    const { data: aliases } = await supabase
      .from("inbox_aliases")
      .select("email_address")
      .eq("inbox_id", inboxId)
      .limit(1);

    const fromAddress = aliases && aliases.length > 0 ? aliases[0].email_address : undefined;

    await smtpClient.sendEmail({
      inboxId,
      teamId,
      to,
      subject,
      bodyText,
      inReplyTo,
      references,
      fromAddress,
    });

    res.json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error("Shopify Order Communication Send Error:", error);
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});


