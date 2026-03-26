// Cloudflare Worker - N2 Grammar Scheduled Notifications
// Environment variables (Cloudflare Dashboard → Settings → Variables မှာ ထည့်ပါ):
//   ONESIGNAL_APP_ID   - OneSignal App ID
//   ONESIGNAL_REST_KEY - OneSignal REST API Key
//   GRAMMAR_JSON_URL   - https://delightpyaesone.github.io/n2-grammar-pwa/n2_shinkanzen_grammar_mm.json

addEventListener('scheduled', (event) => {
    event.waitUntil(sendGrammarNotification());
});

async function sendGrammarNotification() {
    let title = '📖 N2 Grammar';
    let body = 'N2 Grammar ကို ပြန်လေ့လာပါ！';

    try {
        const resp = await fetch(GRAMMAR_JSON_URL);
        const data = await resp.json();
        const points = data.grammar_points;
        if (points && points.length > 0) {
            const g = points[Math.floor(Math.random() * points.length)];
            title = `📖 ${g.grammar}`;
            body = `${g.meaning_myanmar}\n${g.english}`;
        }
    } catch (e) {
        // Grammar JSON မရရင် default message သုံးသည်
    }

    await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${ONESIGNAL_REST_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            included_segments: ['All'],
            headings: { en: title },
            contents: { en: body },
            chrome_web_icon: 'icons/icon-192.svg'
        })
    });
}
