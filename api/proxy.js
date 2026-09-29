export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const targetUrl = `https://kukutv.app${url.pathname === '/api/proxy' ? '' : url.pathname}${url.search}`;

    const method = req.method;
    const headers = { ...req.headers };
    
    // टारगेट डोमेन के हिसाब से हेडर्स सेट करना
    headers['host'] = 'kukutv.app';
    headers['origin'] = 'https://kukutv.app';
    headers['referer'] = 'https://kukutv.app/';
    
    delete headers['connection'];
    delete headers['content-length'];
    delete headers['accept-encoding'];

    let body = undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      if (typeof req.body === 'object') {
        body = JSON.stringify(req.body);
        headers['content-type'] = 'application/json';
      } else {
        body = req.body;
      }
    }

    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: 'manual',
    });

    const contentType = response.headers.get('content-type') || '';
    const responseBuffer = await response.arrayBuffer();
    let responseBody = Buffer.from(responseBuffer);

    // अगर रिस्पॉन्स JSON है, तो उसे पूरी तरह से मॉडिफाई करें
    if (contentType.includes('application/json')) {
      try {
        let jsonString = responseBody.toString('utf8');
        let json = JSON.parse(jsonString);

        // 1. यूज़र प्रोफाइल और सब्सक्रिप्शन डेटा को पूरी तरह प्रीमियम और एक्टिव दिखाना
        if (json.user) {
          json.user.has_premium = true;
          json.user.is_user_anonymous = false;
          json.user.is_phone_verified = true;
          json.user.is_email_verified = true;
        }
        if (typeof json.has_premium !== 'undefined') json.has_premium = true;
        if (typeof json.is_vip_only !== 'undefined') json.is_vip_only = true;
        if (typeof json.is_existing_subscriber !== 'undefined') json.is_existing_subscriber = true;

        // वॉलेट और कॉइन्स को बढ़ाना ताकि कभी कोई रुकावट न आए
        if (json.wallet) {
          json.wallet.free_coins = 99999;
          json.wallet.paid_coins = 99999;
          json.wallet.total_coins = 199998;
        }
        if (json.user && json.user.wallet) {
          json.user.wallet.free_coins = 99999;
          json.user.wallet.paid_coins = 99999;
          json.user.wallet.total_coins = 199998;
        }

        // 2. डीप रिकर्सिव फंक्शन जो हर एक शो, एपिसोड, और लिस्ट के ताले तोड़ देगा
        const unlockEverything = (obj) => {
          if (obj && typeof obj === 'object') {
            // सभी तरह के लॉक और प्रीमियम फ्लैग्स को बाईपास करना
            if ('is_locked' in obj) obj.is_locked = false;
            if ('locked' in obj) obj.locked = false;
            if ('is_premium' in obj) obj.is_premium = false;
            if ('is_vip' in obj) obj.is_vip = false;
            if ('paid' in obj) obj.paid = false;
            if ('free' in obj) obj.free = true;
            if ('monetization_type' in obj) obj.monetization_type = 'free';
            if ('access_type' in obj) obj.access_type = 'free';

            // अगर एपिसोड्स की एरे (Array) है तो सबको फ्री और अनलॉक कर दें
            if (Array.isArray(obj.episodes)) {
              obj.episodes.forEach(ep => {
                if (ep && typeof ep === 'object') {
                  ep.is_locked = false;
                  ep.locked = false;
                  ep.is_premium = false;
                  ep.is_free = true;
                }
              });
            }

            // अगर शो या आइटम्स की लिस्ट है
            if (Array.isArray(obj.items)) {
              obj.items.forEach(item => unlockEverything(item));
            }

            if (Array.isArray(obj.data)) {
              obj.data.forEach(item => unlockEverything(item));
            }

            // नेस्टेड ऑब्जेक्ट्स को डीप स्कैन करना
            Object.values(obj).forEach(val => {
              if (typeof val === 'object' && val !== null) {
                unlockEverything(val);
              }
            });
          }
        };

        unlockEverything(json);
        responseBody = Buffer.from(JSON.stringify(json), 'utf8');
      } catch (e) {
        // यदि पार्सिंग में कोई दिक्कत हो तो ओरिजिनल बॉडी पास करें
      }
    }

    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    return res.status(response.status).send(responseBody);

  } catch (error) {
    return res.status(500).json({ error: 'Proxy Error: ' + error.message });
  }
}
