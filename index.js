import express from "express";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import "@shopify/shopify-api/adapters/node";

const app = express();
const PORT = process.env.PORT || 10000;

/* =======================
   Shopify configuration
======================= */

if (
  !process.env.SHOPIFY_API_KEY ||
  !process.env.SHOPIFY_API_SECRET ||
  !process.env.APP_URL
) {
  throw new Error("Missing required environment variables");
}

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

/* =======================
   In-memory token store
   (DEV ONLY)
======================= */

const OFFLINE_TOKENS = new Map();

/* =======================
   Basic routes
======================= */

app.get("/", (_req, res) => {
  res.send("Donation Allowance backend is running");
});

app.get("/test", (_req, res) => {
  res.send("Backend reachable");
});

/* =======================
   OAuth start
======================= */

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
    return res.status(500).send("OAuth begin failed");
  }
});

/* =======================
   OAuth callback
======================= */

app.get("/auth/callback", async (req, res) => {
  try {
    console.log("🔁 OAuth callback received");

    const session = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    // 🔐 Store token in memory (DEV ONLY)
    OFFLINE_TOKENS.set(session.shop, session.accessToken);

    console.log("✅ OAuth completed");
    console.log("Shop:", session.shop);
    console.log("Token stored in memory");

    res.send("OAuth OK – token stored");
  } catch (error) {
    console.error("❌ OAuth failed:", error);
    res.status(500).send("OAuth failed – see server logs");
  }
});

/* =======================
   Shopify API test
======================= */

app.get("/shop-info", async (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).send("Missing ?shop parameter");
  }

  const token = OFFLINE_TOKENS.get(shop);

  if (!token) {
    return res
      .status(401)
      .send("No access token for this shop. Run OAuth first.");
  }

  try {
    const client = new shopify.clients.Rest({
      session: {
        shop,
        accessToken: token,
      },
    });

    const response = await client.get({ path: "shop" });

    res.json(response.body.shop);
  } catch (error) {
    console.error("❌ Shopify API call failed:", error);
    res.status(500).send("Shopify API call failed");
  }
});

/* =======================
   Start server
======================= */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
