// api/sendReminders.js
// Серверная функция на Vercel для рассылки напоминаний в Telegram.
// Без firebase-admin, без node-fetch. Используем global fetch и web SDK Firebase.

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
} from "firebase/firestore";

// ⚙️ Твой firebaseConfig — такой же, как в фронтенде
const firebaseConfig = {
  apiKey: "AIzaSyCOHeMkOIwG0ddkwh3zz4o5pyfR97jPS50",
  authDomain: "adventlp.firebaseapp.com",
  projectId: "adventlp",
  storageBucket: "adventlp.firebasestorage.app",
  messagingSenderId: "1025160764098",
  appId: "1:1025160764098:web:35d99c13486ece5753f95b",
  measurementId: "G-SNGM8LTHJX",
};

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    const app =
      getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    dbInstance = getFirestore(app);
  }
  return dbInstance;
}

// 🔔 Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is not set");
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });

  const data = await resp.json();
  if (!data.ok) {
    console.error("Failed to send message", data);
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const db = getDb();

    // ⚠️ Имя коллекции: поставь то, которое у тебя реально используется
    // в сохранении подписок на напоминания.
    // Например, если в App.jsx ты пишешь в "reminders" -> оставь "reminders".
    const colRef = collection(db, "reminders");

    const snapshot = await getDocs(colRef);

    const subscribers = snapshot.docs
      .map((doc) => doc.data())
      .filter((d) => d && d.chatId && d.enabled !== false);

    console.log(`Found ${subscribers.length} subscribers`);

    if (!TELEGRAM_BOT_TOKEN) {
      console.error("No TELEGRAM_BOT_TOKEN, skip sending");
      res.status(500).json({
        ok: false,
        error: "Missing TELEGRAM_BOT_TOKEN on server",
      });
      return;
    }

    const now = new Date().toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    });

    const text =
      `✨ Новый день адвент-календаря уже наступил!\n\n` +
      `Загляни в приложение LifePractic Advent за сегодняшним заданием и порцией тепла.\n\n` +
      `Дата: ${now}`;

    await Promise.all(
      subscribers.map((s) => sendTelegramMessage(s.chatId, text))
    );

    res.status(200).json({
      ok: true,
      sent: subscribers.length,
    });
  } catch (err) {
    console.error("sendReminders error:", err);
    res.status(500).json({
      ok: false,
      error: err.message || "Unknown error",
    });
  }
}
