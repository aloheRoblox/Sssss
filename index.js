const bedrock = require('bedrock-protocol');
const express = require('express');

// Environment variables
const SERVER_HOST = process.env.SERVER_HOST || 'Rickandmorty124.aternos.me';
const SERVER_PORT = parseInt(process.env.SERVER_PORT || '34168', 10);
const BOT_USERNAME = process.env.BOT_USERNAME || 'AFK_Bot_Bedrock';
const OFFLINE_MODE = process.env.OFFLINE_MODE !== 'false';

// Discord Webhook
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://discord.com/api/webhooks/1545459848353939556/ul8TrQztHgtvBgcKAXYGMuVNhdmEk3pNZrTNHSWwaxs9fmYn_3qFnv6URKJV2jnXmHWI';

// Web server for hosting keep-alive
const app = express();
const PORT = process.env.PORT || 7860;

app.get('/', (req, res) => {
  res.send('AFK Bot is running');
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// Send messages to Discord
async function sendDiscordMessage(content) {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
  } catch (err) {
    console.error('Discord webhook error:', err.message);
  }
}

let client = null;
let playersList = new Set();
let reconnectTimeout = null;

function safeReconnect() {
  if (reconnectTimeout) return;

  if (client) {
    try {
      client.removeAllListeners();
    } catch (e) {}
    client = null;
  }
  
  playersList.clear();
  console.log('Reconnecting in 5 seconds...');

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    startBot();
  }, 5000);
}

function startBot() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  console.log(`Connecting to ${SERVER_HOST}:${SERVER_PORT}...`);

  try {
    client = bedrock.createClient({
      host: SERVER_HOST,
      port: SERVER_PORT,
      username: BOT_USERNAME,
      offline: OFFLINE_MODE,
      connectTimeout: 10000,
      skipPing: true
    });

    // Resource pack response
    client.on('resource_packs_info', () => {
      console.log('Responding to resource packs...');
      client.write('resource_pack_client_response', {
        response_status: 'completed',
        resourcepackids: []
      });
    });

    // Server kick reason
    client.on('disconnect', (packet) => {
      let reason = 'Disconnected by server';
      if (packet) {
        if (typeof packet === 'string') reason = packet;
        else if (packet.reason) reason = typeof packet.reason === 'string' ? packet.reason : JSON.stringify(packet.reason);
        else if (packet.message) reason = packet.message;
      }
      console.log(`Kicked by server. Reason: ${reason}`);
      sendDiscordMessage(`Kicked from server. Reason: ${reason}. Retrying in 5 seconds...`);
      safeReconnect();
    });

    // Player list
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
      console.log(`Bot ${BOT_USERNAME} joined the server.`);
      
      setTimeout(() => {
        const onlineCount = playersList.size > 0 ? playersList.size : 'Unknown';
        sendDiscordMessage(`Bot connected as ${BOT_USERNAME}. Online players: ${onlineCount}`);
      }, 3000);
    });

    // Auto-respawn on death
    client.on('set_health', (packet) => {
      if (packet.health <= 0) {
        console.log('Bot died, respawning...');
        
        client.write('respawn', {
          state: 0,
          runtime_entity_id: client.entityId || 0
        });

        sendDiscordMessage(`Bot died and automatically respawned.`);
      }
    });

    client.on('respawn', () => {
      client.write('respawn', {
        state: 0,
        runtime_entity_id: client.entityId || 0
      });
    });

    // Chat forwarding
    client.on('text', (packet) => {
      const author = packet.source_name || packet.author || 'Server';
      const message = packet.message;

      if (message && message.trim() !== '') {
        console.log(`${author}: ${message}`);
        
        if (author !== BOT_USERNAME) {
          sendDiscordMessage(`${author}: ${message}`);
        }
      }
    });

    client.on('close', () => {
      console.log('Connection closed.');
      safeReconnect();
    });

    client.on('error', (err) => {
      const errorMsg = err.message || err;
      console.error('Connection error:', errorMsg);
      sendDiscordMessage(`Connection error: ${errorMsg}. Retrying in 5 seconds...`);
      safeReconnect();
    });

  } catch (err) {
    console.error('Exception:', err.message || err);
    safeReconnect();
  }
}

startBot();
