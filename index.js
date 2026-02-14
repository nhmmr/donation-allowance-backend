import "@shopify/shopify-api/adapters/node";
import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";

const app = express();
const PORT = process.env.PORT || 10000;

/* ------------------------------------------------------------------ */
/* Middleware */
/* ------------------------------------------------------------------ */

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* ------------------------------------------------------------------ */
/* Shopify SDK init */
/* ------------------------------------------------------------------ */

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SHOPIFY_SCOPES.split(","),
  hostName: "donation-allowance-backend.onrender.com",
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false,
});

/* ------------------------------------------------------------------ */
/* Simple in-memory token store (OK til single shop) */
/* ------------------------------------------------------------------ */

let SHOPIFY_ACCESS_TOKEN = null;

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

async function shopifyGraphQL(query, variables = {}) {
  if (!SHOPIFY_ACCESS_TOKEN) {
    throw new Error("Missing Shopify access token");
  }

  const res = await fetch(
    `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/${LATEST_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  const json = await res.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data;
}

/* ------------------------------------------------------------------ */
/* Routes */
/* ------------------------------------------------------------------ */

app.get("/", (req, res) => {
  res.send("Donation Allowance backend is running");
});

/* ------------------------------------------------------------------ */
/* OAuth start */
/* ------------------------------------------------------------------ */

app.get("/auth", async (req, res) => {
  const authRoute = await shopify.auth.begin({
    shop: process.env.SHOPIFY_SHOP_DOMAIN,
    callbackPath: "/auth/callback",
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });

  return res.redirect(authRoute);
});

/* ------------------------------------------------------------------ */
/* OAuth callback */
/* ------------------------------------------------------------------ */

app.get("/auth/callback", async (req, res) => {
  try {
    const session = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    SHOPIFY_ACCESS_TOKEN = session.accessToken;

    console.log("✅ SHOPIFY ACCESS TOKEN RECEIVED");
    console.log(SHOPIFY_ACCESS_TOKEN);

    res.send(
      "App installed successfully. You can close this window."
    );
  } catch (err) {
    console.error("❌ OAuth error:", err);
    res.status(500).send("OAuth failed");
  }
});

/* ------------------------------------------------------------------ */
/* One-time webhook setup */
/* ------------------------------------------------------------------ */

app.post("/setup/webhooks", async (req, res) => {
  try {
    const webhooks = [
      { topic: "PRODUCTS_CREATE", path: "/webhooks/product-created" },
      { topic: "ORDERS_CREATE", path: "/webhooks/order-created" },
      { topic: "FULFILLMENTS_CREATE", path: "/webhooks/fulfillment-created" }
    ];

    for (const { topic, path } of webhooks) {
      const mutation = `
        mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
          webhookSubscriptionCreate(
            topic: $topic
            webhookSubscription: {
              callbackUrl: $callbackUrl
              format: JSON
            }
          ) {
            webhookSubscription {
              id
              topic
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const callbackUrl =
        `https://donation-allowance-backend.onrender.com${path}`;

      const result = await shopifyGraphQL(mutation, {
        topic,
        callbackUrl
      });

      console.log("🔔 Webhook setup:", JSON.stringify(result));
    }

    res.json({ ok: true, message: "Webhooks created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/* Webhook receivers (placeholders) */
/* ------------------------------------------------------------------ */

app.post("/webhooks/product-created", (req, res) => {
  console.log("📦 Product created");
  res.status(200).send("OK");
});

app.post("/webhooks/order-created", (req, res) => {
  console.log("🧾 Order created");
  res.status(200).send("OK");
});

app.post("/webhooks/fulfillment-created", (req, res) => {
  console.log("🚚 Fulfillment created");
  res.status(200).send("OK");
});

/* ------------------------------------------------------------------ */
/* Start server */
/* ------------------------------------------------------------------ */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
