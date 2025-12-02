// api/sendReminders.js
// Узел: серверная функция на Vercel для рассылки напоминаний в Telegram
// БЕЗ firebase-admin, только web-SDK firebase + Telegram Bot API.

import fetch from "node-fetch"; // Vercel тянет node-fetch v2, это ок
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
} from "firebase/firestore";

// ---- Конфиг Firebase из переменной окружения ----
// В Vercel у тебя уже есть переменная FIREBASE_API_KEY,
// в неё мы раньше клали ВЕСЬ объект firebaseConfig в формате JSON.
// Здесь просто парсим его.
const rawConfig = process.env.FIREBASE_API_KEY;

if (!rawConfig) {
  console.error("FIREBASE_API_KEY is not set in environment variables");
}

let db = null;

function getDb() {
  if (!db) {
    if (!rawConfig) {
      throw new Error("Missing FIREBASE_API_KEY env var with firebaseConfig JSON");
    }

    const firebaseConfig = JSON.parse(rawConfig);

    const app =
      getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
  return db;
}

// ---- Telegram ----
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

// ---- Handler ----
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const db = getDb();

    // Коллекция, где мы храним подписки из приложения
    // (Я раньше предлагал что-то вроде "adventlp_reminders" —
    //   если у тебя другое имя, просто поменяй его тут.)
    const colRef = collection(db, "adventlp_reminders");

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

    // Рассылаем всем подписчикам
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
