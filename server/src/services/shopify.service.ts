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
      // Tokens starting with "shpat_" are plaintext Shopify tokens
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

// Run migration once at startup
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

  const shopify = shopifyApi({
    apiKey: data.api_key,
    apiSecretKey: decrypt(data.api_secret),
    scopes: ["read_customers", "read_orders", "write_orders"],
    hostName: data.app_host_name || "mail.tim-regener.com",
    hostScheme: "https",
    apiVersion: ApiVersion.April25,
    isEmbeddedApp: false,
    logger: { level: LogSeverity.Warning },
  });

  instanceCache.set(teamId, shopify);
  return shopify;
}

export function invalidateShopifyForTeam(teamId: string) {
  instanceCache.delete(teamId);
}
