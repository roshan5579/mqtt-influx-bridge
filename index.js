const mqtt = require("mqtt");
const axios = require("axios");

// Configuration
const MQTT_BROKER = "mqtts://01792b66dfee4540a546dc894922fb94.s1.eu.hivemq.cloud:8883";
const MQTT_TOPIC = "tractor/data";
const INFLUX_URL = "https://eu-central-1-1.aws.cloud2.influxdata.com/api/v2/write?org=Moonrider%20Pvt%20Ltd&bucket=Tractor_Data&precision=s";
const TOKEN = "BQ1heSXdZ6SVV-WlbYj1Su-p2qJbsMSNYtk5KEGE3kTno9LoGakSKfJGGhQsxNqGdsPMPpaFq5NtFpgMtT2I-w==";

// MQTT options
const MQTT_OPTIONS = {
  username: "MR_TRACTOR",
  password: "#Lokesh000",
  keepalive: 60,              // keep connection alive
  reconnectPeriod: 5000,      // try to reconnect every 5 seconds
  connectTimeout: 30 * 1000,
};

let client;

function connect() {
  client = mqtt.connect(MQTT_BROKER, MQTT_OPTIONS);

  client.on("connect", () => {
    console.log("✅ Connected to HiveMQ");
    client.subscribe(MQTT_TOPIC, (err) => {
      if (err) console.error("❌ Subscribe error:", err);
      else console.log(`📡 Subscribed to ${MQTT_TOPIC}`);
    });
  });

  client.on("message", async (topic, message) => {
    const line = message.toString();
    console.log("📨 Received:", line);

    try {
      await axios.post(INFLUX_URL, line, {
        headers: {
          Authorization: `Token ${TOKEN}`,
          "Content-Type": "text/plain",
        },
        timeout: 10000, // 10 seconds timeout for InfluxDB write
      });
      console.log("✅ Data written to InfluxDB");
    } catch (err) {
      console.error("❌ InfluxDB error:", err.response?.data || err.message);
    }
  });

  client.on("error", (err) => {
    console.error("❌ MQTT error:", err);
  });

  client.on("close", () => {
    console.log("⚠️ MQTT connection closed, will reconnect automatically");
  });

  client.on("reconnect", () => {
    console.log("🔄 Attempting to reconnect...");
  });
}

// Start connection
connect();

// Graceful shutdown (optional)
process.on("SIGINT", () => {
  console.log("Shutting down...");
  if (client) client.end();
  process.exit(0);
});
