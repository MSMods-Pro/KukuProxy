export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const targetUrl = `https://kukutv.app${url.pathname === '/api/proxy' ? '' : url.pathname}${url.search}`;

    const method = req.method;
    const headers = { ...req.headers };
    
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

    const contentType = response.headers.get('content-type'] || '';
    const responseBuffer = await response.arrayBuffer();
    let responseBody = Buffer.from(responseBuffer);

    // अगर रिस्पॉन्स JSON है, तो उसमें यूजर और सब्सक्रिप्शन डेटा को पूरी तरह मॉडिफाई करें
    if (contentType.includes('application/json')) {
      try {
        let jsonString = responseBuffer.toString('utf8');
        let json = JSON.parse(jsonString);

        // 1. यूज़र प्रोफाइल को पूरी तरह एक्टिव, वेरीफाइड और प्रीमियम बनाना
        if (json.user || typeof json === 'object') {
          if (!json.user) json.user = {};
          
          json.is_self = true;
          json.has_premium = true;
          json.is_anonymous = false;
          json.is_vip_only = true;

          json.user.id = 400667862;
          json.user.name = "Thriller_Trendsetter827F";
          json.user.email = "user@kukufm.com";
          json.user.phone = "+919876543210";
          json.user.has_premium = true;
          json.user.is_user_anonymous = false;
          json.user.is_phone_verified = true;
          json.user.is_email_verified = true;
          json.user.is_existing_subscriber = true;
          json.user.firebase_signin_provider = "password";
          json.user.uuid = "9bee6fd333114a5ba7f0cd983d159500";
        }

        // 2. सब्सक्रिप्शन प्लान को हमेशा Active दिखाना
        json.subscription_plan = {
          is_free_trial: false,
          plan_id: 801,
          plan_name: "Quarterly Premium Plus",
          short_plan_name: "Premium",
          description: "Subscription Active",
          plan_type: "overall",
          is_recurring: true,
          validity: 90,
          selling_price: 0.0,
          discounted_selling_price: 0.0,
          currency_symbol: "₹",
          currency_code: "INR",
          renewal_date: "02 Oct, 2026",
          validity_text: "3 months",
          paywall_name: "Active Plan",
          summary: "Subscription is Active",
          comparison_price: "₹233/month",
          summary_html: "<b>Subscription Active</b>",
          comparison_price_html: "Active Plan",
          is_default: true,
          is_vip: true,
          first_name: "Quarterly",
          deal_price: 0.0
        };

        json.payment_preference = "none";
        json.is_first_time_payment = false;

        // 3. वॉलेट और कॉइन्स को फुल करना
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

        // 4. डीप रिकर्सिव फंक्शन जो हर एक शो, एपिसोड और लिस्ट के ताले तोड़ देगा
        const unlockEverything = (obj) => {
          if (obj && typeof obj === 'object') {
            if ('is_locked' in obj) obj.is_locked = false;
            if ('locked' in obj) obj.locked = false;
            if ('is_premium' in obj) obj.is_premium = false;
            if ('is_vip' in obj) obj.is_vip = true;
            if ('paid' in obj) obj.paid = false;
            if ('free' in obj) obj.free = true;
            if ('monetization_type' in obj) obj.monetization_type = 'free';
            if ('access_type' in obj) obj.access_type = 'free';

            // एपिसोड्स लिस्ट को पूरी तरह से अनलॉक करना
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

            if (Array.isArray(obj.items)) {
              obj.items.forEach(item => unlockEverything(item));
            }
            if (Array.isArray(obj.data)) {
              obj.data.forEach(item => unlockEverything(item));
            }

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
        // पार्सिंग एरर पर ओरिजिनल बॉडी भेजें
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
