
import express from "express";
import cookieParser from "cookie-parser";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import "@shopify/shopify-api/adapters/node";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cookieParser());

/* ---------------- Shopify config ---------------- */
  const appUrl =
  process.env.APP_URL || "http://localhost:10000";

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: (process.env.SCOPES || "read_customers,write_customers,read_orders,read_fulfillments,read_products,write_products").split(","),
hostName: appUrl.replace(/^https?:\/\//, ""),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

/* ---------------- Health check ---------------- */

app.get("/", (_req, res) => {
  res.status(200).send("Backend reachable");
});

/* ---------------- OAuth start ---------------- */

app.get("/auth", async (req, res) => {
  try {
    const shop = req.query.shop;

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
    console.error("❌ OAuth begin failed", error);
    return res.status(500).send("OAuth begin failed");
  }
});

/* ---------------- OAuth callback ---------------- */

app.get("/auth/callback", async (req, res) => {
  try {
    console.log("⬅️ OAuth callback received");

    const session = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    console.log("✅ OAuth completed for shop:", session.shop);

    // App install completed
    return res
      .status(200)
      .send(`App successfully installed for ${session.shop}`);
  } catch (error) {
    console.error("❌ OAuth failed", error);
    return res.status(400).send("OAuth failed");
  }
});

/* ---------------- Start server ---------------- */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
