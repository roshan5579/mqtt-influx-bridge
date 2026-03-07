const mqtt = require("mqtt");
const axios = require("axios");

const MQTT_BROKER = "mqtts://01792b66dfee4540a546dc894922fb94.s1.eu.hivemq.cloud:8883";
const MQTT_TOPIC = "tractor/data";

const INFLUX_URL = "https://eu-central-1-1.aws.cloud2.influxdata.com/api/v2/write?org=Moonrider%20Pvt%20Ltd&bucket=Tractor_Data&precision=s";

const TOKEN = "BQ1heSXdZ6SVV-WlbYj1Su-p2qJbsMSNYtk5KEGE3kTno9LoGakSKfJGGhQsxNqGdsPMPpaFq5NtFpgMtT2I-w==";

// Add a queue/buffer for messages
const messageQueue = [];
let isProcessing = false;
let processingInterval = null;

// Add a cache to prevent duplicates (optional, based on your needs)
const recentMessagesCache = new Map();
const CACHE_TTL = 5000; // 5 seconds in milliseconds

const client = mqtt.connect(MQTT_BROKER, {
  username: "MR_TRACTOR",
  password: "#Lokesh000",
  // Add connection options for better reliability
  reconnectPeriod: 1000,
  connectTimeout: 30000,
  keepalive: 60
});

client.on("connect", () => {
  console.log("Connected to HiveMQ");
  client.subscribe(MQTT_TOPIC);
  
  // Start processing queue every 100ms instead of on every message
  processingInterval = setInterval(processMessageQueue, 100);
});

client.on("message", (topic, message) => {
  const line = message.toString();
  
  // Optional: Check for duplicates in recent cache
  const messageHash = createMessageHash(line);
  if (recentMessagesCache.has(messageHash)) {
    console.log("Duplicate message detected, skipping:", line.substring(0, 50) + "...");
    return;
  }
  
  // Add to cache with TTL
  recentMessagesCache.set(messageHash, Date.now());
  
  // Add to queue instead of processing immediately
  messageQueue.push(line);
  console.log("Queued message. Queue size:", messageQueue.length);
});

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [hash, timestamp] of recentMessagesCache.entries()) {
    if (now - timestamp > CACHE_TTL) {
      recentMessagesCache.delete(hash);
    }
  }
}, CACHE_TTL);

async function processMessageQueue() {
  if (isProcessing || messageQueue.length === 0) {
    return;
  }
  
  isProcessing = true;
  
  while (messageQueue.length > 0) {
    const line = messageQueue.shift();
    
    try {
      // Add retry logic with exponential backoff
      await writeToInfluxDBWithRetry(line, 3);
      console.log("Data written to InfluxDB");
    } catch (error) {
      console.log("Failed to write to InfluxDB after retries:", error.message);
      // Optionally: re-queue the message or save to dead letter queue
      // messageQueue.unshift(line); // Uncomment to retry later
    }
  }
  
  isProcessing = false;
}

async function writeToInfluxDBWithRetry(line, maxRetries) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await axios.post(INFLUX_URL, line, {
        headers: {
          "Authorization": `Token ${TOKEN}`,
          "Content-Type": "text/plain"
        },
        signal: controller.signal,
        timeout: 10000 // 10 seconds
      });
      
      clearTimeout(timeoutId);
      return response;
      
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function createMessageHash(line) {
  // Create a simple hash of the message content
  // You can make this more sophisticated based on your needs
  return line.split(',').slice(0, 3).join(','); // Use first 3 fields as unique identifier
}

// Graceful shutdown
process.on('SIGINT', () => {
  if (processingInterval) {
    clearInterval(processingInterval);
  }
  client.end();
  process.exit();
});
