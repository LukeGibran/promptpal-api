const { ChatOpenAI } = require('langchain/chat_models/openai');
const { HumanChatMessage, SystemChatMessage } = require('langchain/schema');
const { createSession } = require('better-sse');
const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

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
  const { query } = req.query;
  const session = await createSession(req, res);
  if (!session.isConnected) throw new Error('Not connected');

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
    stream.on('data', (chunk) => {
      const payloads = chunk.toString().split('\n\n');
      for (const payload of payloads) {
        if (payload.includes('[DONE]')) return session.push('DONE', 'error');
        if (payload.startsWith('data:')) {
          try {
            let data
            data = payload.replace('data: ', '')
            data = JSON.parse(data)
            const chunk = data.choices[0].delta?.content;
            if (chunk) {
              session.push({ text: chunk });
            }
          } catch (error) {
            console.log(`Error with JSON.parse and ${payload}.\n${error}`);
          }
        }
      }
    });

    stream.on('end', () => {
      setTimeout(() => {
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

async function httpUploadFile(req, res) {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(req.file.path));

  const options = {
    headers: {
      'x-api-key': process.env.CHAT_PDF_API_KEY,
      ...formData.getHeaders(),
    },
  };
  axios
    .post('https://api.chatpdf.com/v1/sources/add-file', formData, options)
    .then((response) => {
      console.log('Source ID:', response.data.sourceId);
      res.status(200).send({
        sourceId: response.data.sourceId,
        originalFilename: req.file.originalname,
        filename: req.file.filename
      });
    })
    .catch((error) => {
      console.log('Error:', error.message);
      console.log('Response:', error.response.data);
      res.status(500);
    });
}

async function httpChatFile(req, res) {
  console.log(req.body);
  const config = {
    headers: {
      'x-api-key': process.env.CHAT_PDF_API_KEY,
      'Content-Type': 'application/json',
    },
  };

  const data = {
    sourceId: 'src_FXQUFbOOpOaomolPldxQA',
    messages: [
      {
        role: 'user',
        content: req.body.question,
      },
    ],
  };

  axios
    .post('https://api.chatpdf.com/v1/chats/message', data, config)
    .then((response) => {
      console.log('Result:', response.data.content);
      res.status(200).send();
    })
    .catch((error) => {
      console.error('Error:', error.message);
      console.log('Response:', error.response.data);
      res.status(500);
    });
}

async function httpChatFileStream(req, res) {
  const { query, sourceId } = req.query;
  const session = await createSession(req, res);
  if (!session.isConnected) throw new Error('Not connected');

  const config = {
    headers: {
      'x-api-key': process.env.CHAT_PDF_API_KEY,
    },
    responseType: 'stream',
  };
  const data = {
    stream: true,
    sourceId: sourceId,
    messages: [
      {
        role: 'user',
        content: query,
      },
    ],
  };

  try {
    const response = await axios.post(
      'https://api.chatpdf.com/v1/chats/message',
      data,
      config
    );

    const stream = response.data;

    if (!stream) {
      throw new Error('No data received');
    }

    stream.on('data', (chunk) => {
      const text = chunk.toString();
      session.push({ text });
    });

    stream.on('end', () => {
      setTimeout(() => {
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
  httpChatFileStream,
  httpUploadFile,
  httpGPT3Prompt,
  httpGPTPrompt,
  httpChatFile,
};
