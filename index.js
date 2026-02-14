import "@shopify/shopify-api/adapters/node";

import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";

const app = express();
const PORT = process.env.PORT || 10000;

/* ----------------------------
   Shopify configuration
----------------------------- */
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

/* ----------------------------
   Middleware
----------------------------- */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* ----------------------------
   Health check
----------------------------- */
app.get("/", (req, res) => {
  res.send("Donation Allowance backend is running");
});

/* ----------------------------
   OAuth start
----------------------------- */
app.get("/auth", async (req, res) => {
  try {
    const shop = req.query.shop;

    if (!shop) {
      return res.status(400).send("Missing ?shop parameter");
    }

    await shopify.auth.begin({
      shop,
      callbackPath: "/auth/callback",
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });
  } catch (error) {
    console.error("❌ AUTH BEGIN ERROR");
    console.error(error);
    res.status(500).send("Auth begin failed");
  }
});

/* ----------------------------
   OAuth callback
----------------------------- */
app.get("/auth/callback", async (req, res) => {
  try {
    const session = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    console.log("✅ OAUTH SUCCESS");
    console.log("Shop:", session.shop);
    console.log("Access token received");

    res.send("App installed successfully. You can close this window.");
  } catch (error) {
    console.error("❌ OAUTH ERROR");
    console.error(error);
    console.error("Query:", req.query);

    res.status(500).send("OAuth failed – see server logs");
  }
});

/* ----------------------------
   Start server
----------------------------- */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
