import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION, LogSeverity } from "@shopify/shopify-api";

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || "dummy_api_key",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "dummy_api_secret",
  scopes: ["read_customers", "read_orders", "write_orders"],
  hostName: (process.env.SHOPIFY_APP_HOST_NAME || "localhost:3001").replace(/^https?:\/\//, ''),
  hostScheme: process.env.SHOPIFY_APP_HOST_NAME?.includes("https") ? "https" : "http",
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false, // We are a standalone web app connecting to Shopify, not embedded in admin
  logger: {
    level: LogSeverity.Info,
  },
});
