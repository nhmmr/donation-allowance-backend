import express from "express";
import cookieParser from "cookie-parser";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import "@shopify/shopify-api/adapters/node";

const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SHOPIFY_SHOP_DOMAIN,
  APP_URL,
  PORT = 10000,
} = process.env;

if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET || !SHOPIFY_SHOP_DOMAIN || !APP_URL) {
  throw new Error("Missing required environment variables");
}

const shopify = shopifyApi({
  apiKey: SHOPIFY_API_KEY,
  apiSecretKey: SHOPIFY_API_SECRET,
  scopes: [
    "read_customers",
    "write_customers",
    "read_orders",
    "read_fulfillments",
    "write_products",
  ],
  hostName: APP_URL.replace(/^https?:\/\//, ""),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

const app = express();
app.use(cookieParser());

/**
 * 🔒 HARD LOCK: only allow ONE shop
 */
function assertCorrectShop(req, res) {
  const shop = req.query.shop;
  if (shop !== SHOPIFY_SHOP_DOMAIN) {
    res.status(400).send(
      `Invalid shop. Expected ${SHOPIFY_SHOP_DOMAIN}, got ${shop}`
    );
    return false;
  }
  return true;
}

/**
 * Start OAuth
 */
app.get("/auth", async (req, res) => {
  if (!assertCorrectShop(req, res)) return;

  await shopify.auth.begin({
    shop: SHOPIFY_SHOP_DOMAIN,
    callbackPath: "/auth/callback",
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
});

/**
 * OAuth callback
 */
app.get("/auth/callback", async (req, res) => {
  if (!assertCorrectShop(req, res)) return;

  try {
    const session = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    console.log("✅ OAuth success for", session.shop);

    res.redirect(`${APP_URL}/success`);
  } catch (err) {
    console.error("❌ OAuth failed", err);
    res.status(500).send("OAuth failed – see server logs");
  }
});

/**
 * Health check
 */
app.get("/", (_req, res) => {
  res.send("Donation Allowance backend is running");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
