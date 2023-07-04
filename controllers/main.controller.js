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
      max_tokens: 4096,
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

module.exports = {
  httpLangChainPrompt,
  httpGPTPrompt,
};
