import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";
import {
  shopifyApi,
  LATEST_API_VERSION,
} from "@shopify/shopify-api";

const app = express();
app.use(express.json());

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: [
    "read_customers",
    "write_customers",
    "read_orders",
    "read_fulfillments",
    "write_products",
  ],
  hostName: process.env.APP_URL.replace(/^https?:\/\//, ""),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

app.get("/auth", async (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send("Missing shop param");

  const authRoute = await shopify.auth.begin({
    shop,
    callbackPath: "/auth/callback",
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });

  return res.redirect(authRoute);
});

app.get("/auth/callback", async (req, res) => {
  try {
    const session = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    console.log("✅ OAuth success for", session.shop);
    res.send("App installed successfully 🎉");
  } catch (err) {
    console.error("❌ OAuth failed", err);
    res.status(500).send("OAuth failed – see server logs");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
