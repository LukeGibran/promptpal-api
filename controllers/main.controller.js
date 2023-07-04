const { ChatOpenAI } = require('langchain/chat_models/openai');
const { HumanChatMessage, SystemChatMessage } = require('langchain/schema');
const { createSession } = require('better-sse');
const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function httpLangChainPrompt(req, res) {
  const { query } = req.body;

  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Transfer-Encoding': 'chunked',
      Connection: 'keep-alive',
    });

    const sendToken = (data) => {
      res.write(`${data}`);
    };
    const chat = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      temperature: 0.9,
      streaming: true,
      callbacks: [
        {
          async handleLLMNewToken(token) {
            console.log(token);
            sendToken(token);
          },
          async handleLLMEnd(done) {
            console.log(done);
          },
          handleLLMError: async (e) => {
            console.log(e);
          },
        },
      ],
    });

    await chat.call([
      new SystemChatMessage(
        'You are a helpful assistant that answers questions as best as you can.'
      ),
      new HumanChatMessage(query),
    ]);

    res.end();
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
}

async function httpGPTPrompt(req, res) {
  const { query } = req.query;
  const session = await createSession(req, res);
  if (!session.isConnected) throw new Error('Not connected');

  const { data } = await openai.createCompletion(
    {
      model: 'text-davinci-003',
      n: 1,
      max_tokens: 2097,
      temperature: 0.3,
      stream: true,
      prompt: query,
    },
    {
      timeout: 1000 * 60 * 2,
      responseType: 'stream',
    }
  );

  //what to do when receiving data from the API
  data.on('data', (text) => {
    const lines = text
      .toString()
      .split('\n')
      .filter((line) => line.trim() !== '');
    for (const line of lines) {
      const message = line.replace(/^data: /, '');
      if (message === '[DONE]') {
        //OpenAI sends [DONE] to say it's over
        session.push('DONE', 'error');
        return;
      }
      try {
        const { choices } = JSON.parse(message);
        session.push({ text: choices[0].text });
      } catch (err) {
        console.log(err);
      }
    }
  });

  //connection is close
  data.on('close', () => {
    console.log('close');
    res.end();
  });

  data.on('error', (err) => {
    console.error(err);
  });
}

async function httpGPT3Prompt(req, res) {
  const { query } = req.body;
  try {
    const completion = await openai.createChatCompletion(
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: query },
        ],
        stream: true,
      },
      { responseType: 'stream' }
    );

    const stream = completion.data;
    const sendToken = (data) => {
      res.write(`${data}`);
    };

    stream.on('data', (chunk) => {
      const payloads = chunk.toString().split('\n\n');
      for (const payload of payloads) {
        if (payload.includes('[DONE]')) return;
        if (payload.startsWith('data:')) {
          const data = JSON.parse(payload.replace('data: ', ''));
          try {
            const chunk = data.choices[0].delta?.content;
            if (chunk) {
              sendToken(chunk)
            }
          } catch (error) {
            console.log(`Error with JSON.parse and ${payload}.\n${error}`);
          }
        }
      }
    });

    stream.on('end', () => {
      setTimeout(() => {
        console.log('\nStream done');
        res.end();
      }, 10);
    });

    stream.on('error', (err) => {
      console.log(err);
      res.status(500).send(err);
    });
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
}

module.exports = {
  httpLangChainPrompt,
  httpGPT3Prompt,
  httpGPTPrompt,
};
