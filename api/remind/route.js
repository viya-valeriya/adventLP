// api/remind/route.js
// Минимальная тестовая функция, чтобы проверить, что новый эндпоинт работает.

export async function GET(request) {
  try {
    return Response.json({
      ok: true,
      message: "remind endpoint is alive",
      time: new Date().toISOString()
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: String(e)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
