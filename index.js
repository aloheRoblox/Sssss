const bedrock = require('bedrock-protocol');
const express = require('express');

// Environment variables
const SERVER_HOST = process.env.SERVER_HOST || 'your-server-ip.aternos.me';
const SERVER_PORT = parseInt(process.env.SERVER_PORT || '19132', 10);
const BOT_USERNAME = process.env.BOT_USERNAME || 'AFK_Bot_Bedrock';
const OFFLINE_MODE = process.env.OFFLINE_MODE !== 'false';

// Discord Webhook
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://discord.com/api/webhooks/1545459848353939556/ul8TrQztHgtvBgcKAXYGMuVNhdmEk3pNZrTNHSWwaxs9fmYn_3qFnv6URKJV2jnXmHWI';

// 1. Web server to keep hosting active
const app = express();
const PORT = process.env.PORT || 7860;

app.get('/', (req, res) => {
  res.send('AFK Bot Bedrock with Discord Webhook is running!');
});

app.listen(PORT, () => {
  console.log(`[HTTP] Web server running on port ${PORT}`);
});

// Function to send messages to Discord
async function sendDiscordMessage(content) {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
  } catch (err) {
    console.error('[DISCORD ERROR]', err.message);
  }
}

// 2. Bot logic
let client = null;
let playersList = new Set();

function startBot() {
  console.log(`[BOT] Connecting to ${SERVER_HOST}:${SERVER_PORT}...`);

  try {
    // Auto-detect server version
    client = bedrock.createClient({
      host: SERVER_HOST,
      port: SERVER_PORT,
      username: BOT_USERNAME,
      offline: OFFLINE_MODE
    });

    // Track online players
    client.on('player_list', (packet) => {
      if (packet.records && packet.records.records) {
        for (const record of packet.records.records) {
          if (packet.records.type === 'add') {
            if (record.username) playersList.add(record.username);
          } else if (packet.records.type === 'remove') {
            playersList.delete(record.username);
          }
        }
      }
    });

    // Successful join
    client.on('join', () => {
      console.log(`[SUCCESS] Bot "${BOT_USERNAME}" joined the server!`);
      
      setTimeout(() => {
        const onlineCount = playersList.size > 0 ? playersList.size : 'Unknown';
        sendDiscordMessage(`✅ **[BOT JOINED]**\n🟢 Username: \`${BOT_USERNAME}\`\n📊 Online Players: **${onlineCount}**`);
      }, 3000);
    });

    // Auto-respawn on death
    client.on('set_health', (packet) => {
      if (packet.health <= 0) {
        console.log('[DEATH] Bot died, sending respawn packet...');
        
        client.write('respawn', {
          state: 0,
          runtime_entity_id: client.entityId || 0
        });

        sendDiscordMessage(`💀 **[BOT DIED]** Bot automatically respawned!`);
      }
    });

    client.on('respawn', () => {
      client.write('respawn', {
        state: 0,
        runtime_entity_id: client.entityId || 0
      });
    });

    // Forward game chat to Discord
    client.on('text', (packet) => {
      const author = packet.source_name || packet.author || 'Server';
      const message = packet.message;

      if (message && message.trim() !== '') {
        console.log(`[CHAT] ${author}: ${message}`);
        
        if (author !== BOT_USERNAME) {
          sendDiscordMessage(`💬 **[CHAT] ${author}:** ${message}`);
        }
      }
    });

    // Handle disconnects & auto-reconnect
    client.on('close', () => {
      console.log('[WARNING] Connection lost. Reconnecting in 15 seconds...');
      sendDiscordMessage(`🔴 **[DISCONNECTED]** Connection lost. Reconnecting in 15s...`);
      playersList.clear();
      setTimeout(startBot, 15000);
    });

    client.on('error', (err) => {
      console.error('[ERROR]', err.message || err);
    });

  } catch (err) {
    console.error('[EXCEPTION]', err.message || err);
    setTimeout(startBot, 15000);
  }
}

// Start
startBot();
