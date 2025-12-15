// ===============================
// 0. 初期設定
// ===============================
import "dotenv/config";
import express from "express";
import { google } from "googleapis";

const app = express();
app.use(express.json());


// ===============================
// 1. メッセージ分類
// ===============================
async function classifyMessage(text = "") {
    const t = String(text).toLowerCase();

    if (
        t.includes("営業時間") ||
        t.includes("何時から") ||
        t.includes("場所") ||
        t.includes("どこ") ||
        t.includes("アクセス")
    ) {
        return `
category: 店舗情報
alert: NO
auto_reply: YES
`;
    }

    if (t.includes("vip") || t.includes("シャンパン")) {
        return `
category: VIP
alert: YES
auto_reply: NO
`;
    }

    if (t.includes("落とし物") || t.includes("忘れ物")) {
        return `
category: 落とし物
alert: NO
auto_reply: YES
`;
    }

    if (t.includes("求人") || t.includes("バイト") || t.includes("仕事")) {
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
// 2. 分類結果パース
// ===============================
function parseAIResult(raw = "") {
    const parsed = {};
    raw.split("\n").forEach(line => {
        const [key, value] = line.split(":").map(v => v && v.trim());
        if (key && value) parsed[key] = value;
    });
    return parsed;
}


// ===============================
// 3. 自動返信文生成
// ===============================
function getAutoReplyMessage(parsed) {
    if (parsed.category === "店舗情報") {
        return `お問い合わせありがとうございます！

【基本営業時間】
22:00 〜 翌05:00

【場所】
https://maps.app.goo.gl/oVTnjvmxomGJi98S7

────────────────
▼公式サイト
https://osaka.gala-resort.jp/

▼公式Instagram
https://www.instagram.com/gala.resort/
────────────────

ご不明点があればお気軽にご連絡ください！`;
    }
    return null;
}


// ===============================
// 4. 通知（今は console / 将来 Slack）
// ===============================
function notifyStaff(text) {
    try {
        console.log("=== NOTIFY STAFF ===");
        console.log(text);
        console.log("====================");
    } catch (e) {
        console.error("notifyStaff error:", e);
    }
}


// ===============================
// 5. Google Sheets ログ
// ===============================
async function appendToSheet(parsed, message, sender) {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const autoReply = parsed.auto_reply || "";
    const category = parsed.category || "";
    const alert = parsed.alert || "";

    const status = autoReply === "YES" ? "自動返信済" : "要対応";
    const replyType = autoReply === "YES" ? category : "";

    const row = [
        "",
        "Instagram",
        sender,
        message,
        new Date(), // ← ★ここを変更（JSTで表示される）
        "JA",
        category,
        autoReply,
        status,
        alert,
        "",
        replyType,
    ];

    await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: "Main Log!A:L",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
    });
}



// ===============================
// 6. Webhook（司令塔）
// ===============================
app.post("/webhook", async (req, res) => {
    const message = req.body?.message || "";
    const sender = req.body?.sender || "Unknown";

    console.log("=== /webhook ===", { sender, message });

    try {
        // ① 分類
        const raw = await classifyMessage(message);
        const parsed = parseAIResult(raw);

        console.log("parsed:", parsed);

        // ② VIP通知（Sheetsより先・必ず実行）
        if (parsed.category === "VIP") {
            notifyStaff(`【VIP／予約DM】
内容：${message}
対応：スタッフ対応必要`);
        }

        // ③ Sheets（失敗してもWebhookは落とさない）
        try {
            await appendToSheet(parsed, message, sender);
        } catch (sheetErr) {
            console.error("Sheets error (continue):", sheetErr);
        }

        // ④ 自動返信（今はログのみ）
        const autoReplyMessage = getAutoReplyMessage(parsed);
        console.log("autoReply:", autoReplyMessage ? "あり" : "なし");

        res.sendStatus(200);
    } catch (err) {
        console.error("=== webhook fatal error ===", err);
        res.sendStatus(500);
    }
});


// ===============================
// 7. 動作確認
// ===============================
app.get("/", (_, res) => {
    res.send("Webhook server is running!");
});


// ===============================
// 8. 起動
// ===============================
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});


// ===============================
// 9. テスト用ルート
// ===============================
app.get("/test", async (_, res) => {
    const message = "VIP席空いてますか？";
    const sender = "TEST_USER";

    const raw = await classifyMessage(message);
    const parsed = parseAIResult(raw);

    console.log("TEST parsed:", parsed);

    if (parsed.category === "VIP") {
        notifyStaff(`【VIP／予約DM】
内容：${message}
対応：スタッフ対応必要`);
    }

    try {
        await appendToSheet(parsed, message, sender);
    } catch (e) {
        console.error("TEST Sheets error:", e);
    }

    res.send("OK /test 完了");
});
