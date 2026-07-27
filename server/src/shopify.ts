import "@shopify/shopify-api/adapters/node";
import { shopifyApi, ApiVersion, LogSeverity } from "@shopify/shopify-api";
import type { Shopify } from "@shopify/shopify-api";

export const shopify: ReturnType<typeof shopifyApi> = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || "dummy_api_key",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "dummy_api_secret",
  scopes: ["read_customers", "read_orders", "write_orders"],
  hostName: (process.env.SHOPIFY_APP_HOST_NAME || "localhost:3001").replace(/^https?:\/\//, ''),
  hostScheme: process.env.SHOPIFY_APP_HOST_NAME?.includes("https") ? "https" : "http",
  apiVersion: ApiVersion.April25,
  isEmbeddedApp: false,
  logger: {
    level: LogSeverity.Info,
  },
});
