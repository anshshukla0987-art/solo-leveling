// netlify/functions/chat.js
export async function handler(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { message = '', mode = 'friend' } = body;
    const OPENAI_KEY = process.env.OPENAI_KEY;
    if(!OPENAI_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Server missing OPENAI_KEY' }) };

    const stylePrompts = {
      friend: 'You are a friendly, casual assistant. Be supportive and short with some emojis.',
      teacher: 'You are a clear and patient teacher. Explain step-by-step with examples.',
      gym: 'You are an energetic gym trainer. Use motivational tone and specifics about exercises.',
      mentor: 'You are a wise mentor. Give balanced, reflective guidance and next steps.'
    };

    const systemPrompt = stylePrompts[mode] || stylePrompts.friend;

    const payload = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 600,
      temperature: 0.7
    };

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if(!resp.ok){
      const text = await resp.text();
      return { statusCode: resp.status, body: JSON.stringify({ error: text }) };
    }

    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content || 'No response';
    return { statusCode: 200, body: JSON.stringify({ reply }) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) };
  }
}
