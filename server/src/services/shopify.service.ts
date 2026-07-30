import "@shopify/shopify-api/adapters/node";
import { shopifyApi, ApiVersion, LogSeverity, type Shopify } from "@shopify/shopify-api";
import { getSupabaseAdmin } from "./auth.service.js";
import { decrypt, encrypt } from "../utils/encryption.js";

const instanceCache = new Map<string, Shopify>();

async function migratePlaintextTokens() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: conns } = await supabase
      .from("shopify_connections")
      .select("id, access_token")
      .limit(100);
    if (!conns?.length) return;

    for (const conn of conns) {
      if (conn.access_token && conn.access_token.startsWith("shpat_")) {
        await supabase
          .from("shopify_connections")
          .update({ access_token: encrypt(conn.access_token) })
          .eq("id", conn.id);
      }
    }
  } catch (err) {
    console.error("[Shopify] Token migration error:", err);
  }
}

migratePlaintextTokens();

export async function getShopifyForTeam(teamId: string): Promise<Shopify | null> {
  if (instanceCache.has(teamId)) return instanceCache.get(teamId)!;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("shopify_apps")
    .select("*")
    .eq("team_id", teamId)
    .single();

  if (!data) return null;

  let apiSecretKey: string;
  try {
    apiSecretKey = decrypt(data.api_secret);
  } catch {
    console.error(`[Shopify] Failed to decrypt API secret for team ${teamId}`);
    return null;
  }

  const shopify = shopifyApi({
    apiKey: data.api_key,
    apiSecretKey,
    scopes: ["read_customers", "read_orders", "write_orders"],
    hostName: data.app_host_name || "mail.tim-regener.com",
    hostScheme: "https",
    apiVersion: ApiVersion.October25,
    isEmbeddedApp: false,
    logger: { level: LogSeverity.Warning },
  });

  instanceCache.set(teamId, shopify);
  return shopify;
}

export function invalidateShopifyForTeam(teamId: string) {
  instanceCache.delete(teamId);
}

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
    const { data: rawConnection } = await supabase
      .from("shopify_connections")
      .select("*")
      .eq("team_id", opts.teamId)
      .limit(1)
      .maybeSingle();
    const connection = rawConnection?.access_token ? {
      ...rawConnection,
      access_token: decrypt(rawConnection.access_token),
    } : rawConnection;

    if (!connection) return;

    const dirLabel = opts.direction === "inbound" ? "Eingehend" : "Ausgehend";
    const noteLine = `[TeamMail ${dirLabel}] ${opts.fromAddress}\nBetreff: ${opts.subject}\n${opts.snippet.substring(0, 200)}`;

    const token = connection.access_token;
    const shop = connection.shop_domain;

    const ordersRes = await fetch(`https://${shop}/admin/api/2025-10/graphql.json`, {
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

      await fetch(`https://${shop}/admin/api/2025-10/graphql.json`, {
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
