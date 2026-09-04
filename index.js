const bedrock = require('bedrock-protocol');
const express = require('express');

// Получаем параметры из настроек среды (Variables)
const SERVER_HOST = process.env.SERVER_HOST || 'your-server-ip.aternos.me';
const SERVER_PORT = parseInt(process.env.SERVER_PORT || '19132', 10);
const BOT_USERNAME = process.env.BOT_USERNAME || 'AFK_Bot_Bedrock';
const OFFLINE_MODE = process.env.OFFLINE_MODE !== 'false'; // true — пиратский сервер, false — авторизация Microsoft

// 1. Веб-сервер для удовлетворения требования Hugging Face (Health Check на порту 7860)
const app = express();
const PORT = process.env.PORT || 7860;

app.get('/', (req, res) => {
  res.send('AFK Bot Bedrock работает 24/7!');
});

app.listen(PORT, () => {
  console.log(`[HTTP] Веб-сервер запущен на порту ${PORT}`);
});

// 2. Логика AFK-бота
let client = null;

function startBot() {
  console.log(`[БОТ] Подключение к ${SERVER_HOST}:${SERVER_PORT} с ником "${BOT_USERNAME}"...`);

  try {
    client = bedrock.createClient({
      host: SERVER_HOST,
      port: SERVER_PORT,
      username: BOT_USERNAME,
      offline: OFFLINE_MODE
    });

    client.on('join', () => {
      console.log(`[УСПЕХ] Бот "${BOT_USERNAME}" успешно вошел на сервер!`);
    });

    client.on('text', (packet) => {
      // Вывод чата в консоль Hugging Face
      if (packet.message) {
        console.log(`[ЧАТ] ${packet.source_name || ''}: ${packet.message}`);
      }
    });

    client.on('close', () => {
      console.log('[ВНИМАНИЕ] Соединение закрыто. Переподключение через 15 секунд...');
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

// Запуск бота
startBot();
