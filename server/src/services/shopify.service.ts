import { shopifyApi, ApiVersion, LogSeverity, type Shopify } from "@shopify/shopify-api";
import { getSupabaseAdmin } from "./auth.service.js";

const instanceCache = new Map<string, Shopify>();

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
    apiSecretKey: data.api_secret,
    scopes: ["read_customers", "read_orders", "write_orders"],
    hostName: data.app_host_name || "localhost:3001",
    hostScheme: "http",
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
