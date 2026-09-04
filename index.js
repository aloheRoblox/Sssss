const bedrock = require('bedrock-protocol');
const express = require('express');

// Настройки из переменных окружения
const SERVER_HOST = process.env.SERVER_HOST || 'Rickandmorty124.aternos.me';
const SERVER_PORT = parseInt(process.env.SERVER_PORT || '34168', 10);
const BOT_USERNAME = process.env.BOT_USERNAME || 'AFK_Bot_Bedrock';
const OFFLINE_MODE = process.env.OFFLINE_MODE !== 'false';

// Discord Webhook
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1545459848353939556/ul8TrQztHgtvBgcKAXYGMuVNhdmEk3pNZrTNHSWwaxs9fmYn_3qFnv6URKJV2jnXmHWI';

// 1. Веб-сервер для удержания хостинга в сети
const app = express();
const PORT = process.env.PORT || 7860;

app.get('/', (req, res) => {
  res.send('AFK Bot Bedrock с Discord-вебхуком работает!');
});

app.listen(PORT, () => {
  console.log(`[HTTP] Веб-сервер запущен на порту ${PORT}`);
});

// Функция отправки сообщений в Discord
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

// 2. Логика бота
let client = null;
let playersList = new Set();

function startBot() {
  console.log(`[БОТ] Подключение к ${SERVER_HOST}:${SERVER_PORT}...`);

  try {
    client = bedrock.createClient({
      host: SERVER_HOST,
      port: SERVER_PORT,
      username: BOT_USERNAME,
      offline: OFFLINE_MODE,
      version: '1.26.45' // Поддержка вашей версии
    });

    // Отслеживание списка игроков на сервере
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

    // Успешный вход на сервер
    client.on('join', () => {
      console.log(`[УСПЕХ] Бот "${BOT_USERNAME}" успешно зашел на сервер!`);
      
      // Задержка 3 секунды, чтобы успели загрузиться пакеты с игроками
      setTimeout(() => {
        const onlineCount = playersList.size > 0 ? playersList.size : 'Неизвестно';
        sendDiscordMessage(`✅ **[БОТ ЗАШЕЛ]**\n🟢 Ник: \`${BOT_USERNAME}\`\n📊 Игроков на сервере: **${onlineCount}**`);
      }, 3000);
    });

    // Автоматический респавн после смерти
    client.on('set_health', (packet) => {
      if (packet.health <= 0) {
        console.log('[СМЕРТЬ] Бот умер, отправка пакета возрождения...');
        
        client.write('respawn', {
          state: 0,
          runtime_entity_id: client.entityId || 0
        });

        sendDiscordMessage(`💀 **[БОТ УМЕР]** Бот автоматически возродился!`);
      }
    });

    client.on('respawn', () => {
      client.write('respawn', {
        state: 0,
        runtime_entity_id: client.entityId || 0
      });
    });

    // Пересылка игрового чата в Discord
    client.on('text', (packet) => {
      const author = packet.source_name || packet.author || 'Сервер';
      const message = packet.message;

      if (message && message.trim() !== '') {
        console.log(`[ЧАТ] ${author}: ${message}`);
        
        // Чтобы вебхук не отправлял собственные сообщения повторно
        if (author !== BOT_USERNAME) {
          sendDiscordMessage(`💬 **[ЧАТ] ${author}:** ${message}`);
        }
      }
    });

    // Обработка отключения
    client.on('close', () => {
      console.log('[ВНИМАНИЕ] Соединение разорвано. Переподключение через 15 сек...');
      sendDiscordMessage(`🔴 **[ОТКЛЮЧЕНИЕ]** Потеряно соединение с сервером. Переподключение...`);
      playersList.clear();
      setTimeout(startBot, 15000);
    });

    client.on('error', (err) => {
      console.error('[ОШИБКА]', err.message || err);
    });

  } catch (err) {
    console.error('[ИСКЛЮЧЕНИЕ]', err.message || err);
    setTimeout(startBot, 15000);
  }
}

startBot();
