import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

// Health check (meget vigtigt for Render)
app.get("/", (req, res) => {
  res.send("Donation Allowance app is running");
});

// === WEBHOOK ENDPOINTS ===

// Product created → default metafields
app.post("/webhooks/product-created", async (req, res) => {
  console.log("Product created webhook received");
  res.sendStatus(200);
});

// Fulfillment created → optjening
app.post("/webhooks/fulfillment-created", async (req, res) => {
  console.log("Fulfillment created webhook received");
  res.sendStatus(200);
});

// Order created → forbrug
app.post("/webhooks/order-created", async (req, res) => {
  console.log("Order created webhook received");
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
