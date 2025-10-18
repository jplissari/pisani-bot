import OpenAI from 'openai';

async function test() {
  const apiKey = process.env.OPENAI_API_KEY;

  console.log('OPENAI_API_KEY exists:', !!apiKey);
  console.log('OPENAI_API_KEY length:', apiKey ? apiKey.length : 0);

  if (apiKey) {
    try {
      const openai = new OpenAI({ apiKey });
      console.log('OpenAI client created successfully');
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Say hello' }],
      });
      
      console.log('API Response:', completion.choices[0].message.content);
    } catch (error) {
      console.error('Error calling OpenAI:', error.message);
      console.error('Error details:', error);
    }
  } else {
    console.error('OPENAI_API_KEY not found');
  }
}

test();

