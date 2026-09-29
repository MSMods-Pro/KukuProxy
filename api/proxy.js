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

    const contentType = response.headers.get('content-type') || '';
    const responseBuffer = await response.arrayBuffer();
    let responseBody = Buffer.from(responseBuffer);

    // अगर रिस्पॉन्स JSON है, तो उसे डीप मॉडिफाई करके प्रीमियम और लॉक्स हटाएं
    if (contentType.includes('application/json')) {
      try {
        let jsonString = responseBody.toString('utf8');
        let json = JSON.parse(jsonString);

        if (json.user) {
          json.user.has_premium = true;
          json.user.is_user_anonymous = false;
        }
        if (typeof json.has_premium !== 'undefined') {
          json.has_premium = true;
        }
        if (typeof json.is_vip_only !== 'undefined') {
          json.is_vip_only = true;
        }

        const unlockRecursive = (obj) => {
          if (obj && typeof obj === 'object') {
            if ('is_locked' in obj) obj.is_locked = false;
            if ('locked' in obj) obj.locked = false;
            if ('is_premium' in obj) obj.is_premium = false;
            if ('monetization_type' in obj) obj.monetization_type = 'free';

            if (Array.isArray(obj.episodes)) {
              obj.episodes.forEach(ep => {
                ep.is_locked = false;
                ep.locked = false;
                ep.is_free = true;
              });
            }

            Object.values(obj).forEach(val => {
              if (typeof val === 'object' && val !== null) {
                unlockRecursive(val);
              }
            });
          }
        };

        unlockRecursive(json);
        responseBody = Buffer.from(JSON.stringify(json), 'utf8');
      } catch (e) {}
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
