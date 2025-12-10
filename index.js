console.log("=== Running index.js from:", import.meta.url);
// ===============================
// 1. 必要な読み込み
// ===============================
import "dotenv/config";   // .env 読み込み
import express from "express";
import { google } from "googleapis";  // ← New!! Sheets用

const app = express();
app.use(express.json());


// ===============================
// 2. フェイクAI分類関数（課金不要で開発を進めるため）
// ===============================
async function classifyMessage(text) {

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

    return `
category: その他
alert: NO
auto_reply: YES
    `;
}


// ===============================
// 3. Google Sheets 書き込み関数（ここが新規追加）
// ===============================
async function appendToSheet(parsed, message, sender = "Unknown") {
    try {
        console.log("=== Sheets書き込み開始 ===");

        const auth = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            null,
            process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            ["https://www.googleapis.com/auth/spreadsheets"]
        );

        const sheets = google.sheets({ version: "v4", auth });

        const row = [
            "",                          // ID（シートが自動）
            "Instagram",                 // Source
            sender,                      // Sender
            message,                     // Message
            new Date().toISOString(),    // DateTime
            parsed.language || "",       // Language
            parsed.category || "",       // Category
            parsed.auto_reply || "",     // AutoReply
            parsed.auto_reply === "YES" ? "自動返信済" : "要対応", // Status
            parsed.alert || "",          // Alert
            ""                           // Notes
        ];

        console.log("追加行：", row);

        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: "Main Log!A:K",
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [row] }
        });

        console.log("=== Sheets書き込み成功 ===");

    } catch (err) {
        console.error("=== Sheets書き込みエラー ===");
        console.error(err);
    }
}


// ===============================
// 4. Webhook（Instagram未接続でもOK）
// ===============================
app.post("/webhook", async (req, res) => {
    const message = req.body.message;

    console.log("=== 受信したメッセージ ===");
    console.log(message);
    console.log("===========================");

    const raw = await classifyMessage(message);

    // フェイクAI分類をオブジェクト化する（追加）
    const parsed = {};
    raw.split("\n").forEach(line => {
        const [key, value] = line.split(":").map(v => v && v.trim());
        if (key && value) parsed[key] = value;
    });

    console.log("=== AI分類結果 ===");
    console.log(parsed);
    console.log("=======================");

    // ⭐ 新規追加：Google Sheets へ書き込み
    await appendToSheet(parsed, message);

    res.sendStatus(200);
});


// ===============================
// ===============================
// 5. 動作確認用（GET）
// ===============================
app.get("/", (req, res) => {
    res.send("Webhook server is running!");
});

// ★ 追加：テストエンドポイント（ここを必ず / と listen の間に入れる！）
app.get("/test", async (req, res) => {
    try {
        const message = "VIP席空いてますか？";

        console.log("=== /test エンドポイント 呼び出し ===");
        console.log("テストメッセージ:", message);

        const raw = await classifyMessage(message);

        // フェイクAI結果をオブジェクト化
        const parsed = {};
        raw.split("\n").forEach(line => {
            const [key, value] = line.split(":").map(v => v && v.trim());
            if (key && value) parsed[key] = value;
        });

        console.log("=== AI分類結果 ===");
        console.log(parsed);

        await appendToSheet(parsed, message, "TEST_USER");

        console.log("=== /test: Sheets書き込み完了 ===");
        res.send("OK! シートに書き込みました。");
    } catch (err) {
        console.error("=== /test エラー ===");
        console.error(err);
        res.status(500).send("ERROR");
    }
});

// ===============================
// 6. サーバー起動
// ===============================
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});


