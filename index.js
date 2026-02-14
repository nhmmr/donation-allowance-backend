import express from "express";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import "@shopify/shopify-api/adapters/node";

const app = express();
const PORT = process.env.PORT || 10000;

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: [
    "read_customers",
    "write_customers",
    "read_orders",
    "read_fulfillments",
    "read_products",
    "write_products",
  ],
  hostName: process.env.APP_URL.replace(/^https?:\/\//, ""),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

app.get("/", (_req, res) => {
  res.send("Donation Allowance backend is running");
});

/**
 * START OAUTH
 * Shopify will call this with ?shop=xxx.myshopify.com
 */
app.get("/auth", async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).send("Missing shop parameter");
    }

    console.log("➡️ Starting OAuth for shop:", shop);

    const authRoute = await shopify.auth.begin({
      shop,
      callbackPath: "/auth/callback",
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });

    return res.redirect(authRoute);
  } catch (error) {
    console.error("❌ OAuth begin failed:", error);
    res.status(500).send("OAuth begin failed");
  }
});

/**
 * OAUTH CALLBACK
 * Shopify redirects here after login
 */
app.get("/auth/callback", async (req, res) => {
  try {
    console.log("🔁 OAuth callback received");

    const session = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    console.log("✅ OAuth completed for shop:", session.shop);

    // SUCCESS — redirect wherever you want
    return res.redirect(
      `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`
    );
  } catch (error) {
    console.error("❌ OAuth failed:", error);
    return res.status(500).send("OAuth failed");
  }
});
app.get("/test", (req, res) => {
  res.send("Backend reachable");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
