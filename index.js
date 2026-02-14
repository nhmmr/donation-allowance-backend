import express from "express";
import cookieParser from "cookie-parser";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import "@shopify/shopify-api/adapters/node";

const app = express();
app.use(cookieParser());

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
  isEmbeddedApp: false,
});

const OFFLINE_TOKENS = new Map();

/**
 * START OAUTH
 */
app.get("/auth", async (req, res) => {
  const shop = req.query.shop;

  if (!shop) {
    return res.status(400).send("Missing ?shop parameter");
  }

  console.log("➡️ Starting OAuth for shop:", shop);

  await shopify.auth.begin({
    shop,
    callbackPath: "/auth/callback",
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
});

/**
 * OAUTH CALLBACK
 */
app.get("/auth/callback", async (req, res) => {
  try {
    console.log("🔁 OAuth callback received");

    const session = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    OFFLINE_TOKENS.set(session.shop, session.accessToken);

    console.log("✅ OAuth completed");
    console.log("Shop:", session.shop);

    res.send("OAuth successful. App installed.");
  } catch (error) {
    console.error("❌ OAUTH FAILED");
    console.error(error);
    res.status(500).send("OAuth failed – see server logs");
  }
});

/**
 * HEALTH CHECK
 */
app.get("/", (_req, res) => {
  res.send("Backend reachable");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
