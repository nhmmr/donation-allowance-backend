import express from "express";
import cookieParser from "cookie-parser";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import "@shopify/shopify-api/adapters/node";

const app = express();
const PORT = process.env.PORT || 10000;

/* =======================
   Shopify configuration
======================= */

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

/* =======================
   Express middleware
======================= */

app.use(cookieParser());
app.use(express.json());

/* =======================
   Health check
======================= */

app.get("/", (_req, res) => {
  res.send("Donation Allowance backend is running");
});

/* =======================
   OAuth start
======================= */

app.get("/auth", async (req, res) => {
  const { shop } = req.query;

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

/* =======================
   OAuth callback
======================= */

app.get("/auth/callback", async (req, res) => {
  try {
    console.log("⬅️ OAuth callback received");

    const session = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    console.log("✅ OAuth completed for shop:", session.shop);

    return res.send("App installed successfully 🎉");
  } catch (error) {
    console.error("❌ OAuth failed:", error);
    return res.status(500).send("OAuth failed – see server logs");
  }
});

/* =======================
   Start server
======================= */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
