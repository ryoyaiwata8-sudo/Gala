// ===============================
// 1. 必要な読み込み
// ===============================
import "dotenv/config";   // .env 読み込み
import express from "express";

const app = express();
app.use(express.json());


// ===============================
// 2. フェイクAI分類関数（課金不要で開発を進めるため）
// ===============================
async function classifyMessage(text) {

    // キーワードで仮分類（本物っぽい挙動）
    if (text.includes("VIP") || text.includes("vip") || text.includes("シャンパン")) {
        return `
category: VIP
alert: YES
auto_reply: NO
    `;
    }

    if (text.includes("落とし物") || text.includes("忘れ物")) {
        return `
category: 落とし物
alert: NO
auto_reply: YES
    `;
    }

    if (text.includes("求人") || text.includes("バイト") || text.includes("仕事")) {
        return `
category: 求人
alert: NO
auto_reply: YES
    `;
    }

    // デフォルト
    return `
category: その他
alert: NO
auto_reply: YES
  `;
}


// ===============================
// 3. Webhook（Instagram未接続でもOK）
// ===============================
app.post("/webhook", async (req, res) => {
    const message = req.body.message;

    console.log("=== 受信したメッセージ ===");
    console.log(message);
    console.log("===========================");

    // フェイクAI分類
    const result = await classifyMessage(message);

    console.log("=== AI分類結果 ===");
    console.log(result);
    console.log("=======================");

    res.sendStatus(200);
});

// ===============================
// 4. 動作確認用（GET）
// ===============================
app.get("/", (req, res) => {
    res.send("Webhook server is running!");
});


// ===============================
// 5. サーバー起動
// ===============================
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
