const mqtt = require("mqtt");
const axios = require("axios");

const MQTT_BROKER = "mqtts://01792b66dfee4540a546dc894922fb94.s1.eu.hivemq.cloud:8883";
const MQTT_TOPIC = "tractor/data";

const INFLUX_URL = "https://eu-central-1-1.aws.cloud2.influxdata.com/api/v2/write?org=Moonrider%20Pvt%20Ltd&bucket=Tractor_Data&precision=s";
const TOKEN = "BQ1heSXdZ6SVV-WlbYj1Su-p2qJbsMSNYtk5KEGE3kTno9LoGakSKfJGGhQsxNqGdsPMPpaFq5NtFpgMtT2I-w==";

// Message queue with size limit
const messageQueue = [];
const MAX_QUEUE_SIZE = 1000;
let isProcessing = false;

// Simple in-memory cache for duplicate prevention
const recentMessages = new Set();
const CACHE_SIZE = 100;

const client = mqtt.connect(MQTT_BROKER, {
  username: "MR_TRACTOR",
  password: "#Lokesh000",
  reconnectPeriod: 1000,
  connectTimeout: 30000,
  keepalive: 60
});

client.on("connect", () => {
  console.log("✅ Connected to HiveMQ Cloud");
  client.subscribe(MQTT_TOPIC, (err) => {
    if (err) {
      console.error("❌ Subscription error:", err);
    } else {
      console.log(`📡 Subscribed to topic: ${MQTT_TOPIC}`);
    }
  });
});

client.on("message", (topic, message) => {
  const line = message.toString().trim();
  
  // Basic duplicate check (optional - remove if not needed)
  if (recentMessages.has(line)) {
    console.log("⚠️ Duplicate message detected, skipping");
    return;
  }
  
  // Add to recent messages cache
  recentMessages.add(line);
  if (recentMessages.size > CACHE_SIZE) {
    const firstItem = recentMessages.values().next().value;
    recentMessages.delete(firstItem);
  }
  
  // Queue message
  if (messageQueue.length < MAX_QUEUE_SIZE) {
    messageQueue.push(line);
    console.log(`📥 Queued message. Queue size: ${messageQueue.length}`);
  } else {
    console.log("⚠️ Queue full, dropping message");
  }
});

client.on("error", (err) => {
  console.error("❌ MQTT Error:", err);
});

// Process queue every 200ms
setInterval(processQueue, 200);

async function processQueue() {
  if (isProcessing || messageQueue.length === 0) return;
  
  isProcessing = true;
  
  while (messageQueue.length > 0) {
    const line = messageQueue[0]; // Peek at first item
    
    try {
      await writeToInfluxDB(line);
      messageQueue.shift(); // Remove only on success
      console.log(`✅ Written to InfluxDB. Queue remaining: ${messageQueue.length}`);
    } catch (error) {
      console.error("❌ Failed to write to InfluxDB:", error.message);
      // Stop processing on error to prevent infinite loop
      break;
    }
  }
  
  isProcessing = false;
}

async function writeToInfluxDB(line) {
  const response = await axios.post(INFLUX_URL, line, {
    headers: {
      "Authorization": `Token ${TOKEN}`,
      "Content-Type": "text/plain"
    },
    timeout: 5000 // 5 second timeout
  });
  
  return response;
}

// Health check endpoint for Render
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    status: 'running',
    queueSize: messageQueue.length,
    mqttConnected: client.connected,
    uptime: process.uptime()
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌍 Health check server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  client.end();
  process.exit(0);
});
