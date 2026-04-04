const mqtt = require("mqtt");
const axios = require("axios");

// Configuration
const MQTT_BROKER = "mqtts://01792b66dfee4540a546dc894922fb94.s1.eu.hivemq.cloud:8883";
const MQTT_TOPIC = "tractor/data";
const INFLUX_URL = "https://eu-central-1-1.aws.cloud2.influxdata.com/api/v2/write?org=Moonrider%20Pvt%20Ltd&bucket=27HPDATAVERSION1&precision=s";
const TOKEN = "BQ1heSXdZ6SVV-WlbYj1Su-p2qJbsMSNYtk5KEGE3kTno9LoGakSKfJGGhQsxNqGdsPMPpaFq5NtFpgMtT2I-w==";

// MQTT Options with keepalive
const MQTT_OPTIONS = {
    username: "MR_TRACTOR",
    password: "#Lokesh000",
    keepalive: 60,                    // Send ping every 60 seconds
    reconnectPeriod: 5000,            // Reconnect every 5 seconds if disconnected
    connectTimeout: 30 * 1000,        // 30 second connection timeout
    clean: true,                      // Clean session
    clientId: `tractor_bridge_${Math.random().toString(16).substr(2, 8)}` // Unique client ID
};

let client;
let reconnectAttempts = 0;
let lastMessageTime = Date.now();
let healthCheckInterval;

// Create HTTP server for health checks (keeps Render worker alive)
const http = require('http');
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            mqtt: client ? client.connected : false,
            lastMessage: lastMessageTime,
            uptime: process.uptime(),
            reconnectAttempts: reconnectAttempts
        }));
    } else {
        res.writeHead(200);
        res.end('MQTT to InfluxDB Bridge Running');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Health check server running on port ${PORT}`);
});

// Connect to MQTT
function connectMQTT() {
    console.log(`Connecting to HiveMQ (attempt ${reconnectAttempts + 1})...`);
    
    client = mqtt.connect(MQTT_BROKER, MQTT_OPTIONS);

    client.on("connect", () => {
        console.log("✅ Connected to HiveMQ");
        reconnectAttempts = 0;
        
        client.subscribe(MQTT_TOPIC, { qos: 1 }, (err) => {
            if (err) {
                console.error("❌ Subscribe error:", err);
            } else {
                console.log(`📡 Subscribed to ${MQTT_TOPIC}`);
            }
        });
    });

    client.on("message", async (topic, message) => {
        const line = message.toString();
        console.log(`📨 Received [${new Date().toISOString()}]:`, line.substring(0, 100) + (line.length > 100 ? '...' : ''));
        lastMessageTime = Date.now();

        try {
            await axios.post(INFLUX_URL, line, {
                headers: {
                    "Authorization": `Token ${TOKEN}`,
                    "Content-Type": "text/plain"
                },
                timeout: 10000  // 10 second timeout for InfluxDB write
            });
            console.log("✅ Data written to InfluxDB");
        } catch (err) {
            console.error("❌ InfluxDB error:", err.response?.data || err.message);
        }
    });

    client.on("error", (err) => {
        console.error("❌ MQTT error:", err.message);
    });

    client.on("close", () => {
        console.log("⚠️ MQTT connection closed");
    });

    client.on("reconnect", () => {
        reconnectAttempts++;
        console.log(`🔄 Reconnecting... (attempt ${reconnectAttempts})`);
    });

    client.on("offline", () => {
        console.log("📡 MQTT client offline");
    });
}

// Health check to ensure process stays alive
function startHealthCheck() {
    healthCheckInterval = setInterval(() => {
        const now = Date.now();
        const timeSinceLastMessage = (now - lastMessageTime) / 1000;
        
        if (timeSinceLastMessage > 300) { // 5 minutes no message
            console.log(`⚠️ No messages for ${timeSinceLastMessage} seconds`);
        }
        
        if (!client || !client.connected) {
            console.log("⚠️ MQTT disconnected, attempting reconnect...");
            if (client) client.end();
            connectMQTT();
        }
    }, 30000); // Check every 30 seconds
}

// Graceful shutdown
process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down...");
    clearInterval(healthCheckInterval);
    if (client) client.end();
    server.close(() => {
        console.log("✅ Server closed");
        process.exit(0);
    });
});

process.on("SIGTERM", () => {
    console.log("\n🛑 Received SIGTERM, shutting down...");
    clearInterval(healthCheckInterval);
    if (client) client.end();
    server.close(() => {
        console.log("✅ Server closed");
        process.exit(0);
    });
});

// Start the bridge
console.log("🚀 Starting MQTT to InfluxDB Bridge...");
console.log(`MQTT Broker: ${MQTT_BROKER}`);
console.log(`MQTT Topic: ${MQTT_TOPIC}`);
console.log(`InfluxDB: ${INFLUX_URL.split('?')[0]}`);

connectMQTT();
startHealthCheck();

// Keep process alive with a simple interval
setInterval(() => {
    // This ensures Node.js doesn't exit
}, 60000);
