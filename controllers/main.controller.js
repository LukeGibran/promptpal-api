const { ChatOpenAI } = require('langchain/chat_models/openai');
const { HumanChatMessage, SystemChatMessage } = require('langchain/schema');


async function httpPrompt(req, res) {
  const { query } = req.body;

    try {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });

      const sendToken = (data) => {
        res.write(`${(data)}`);
      };
      const chat = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        temperature: 0.9,
        streaming: true,
        callbacks: [{
          async handleLLMNewToken(token) {
            console.log(token);
            sendToken(token);
          },
          async handleLLMEnd(done) {
            console.log(done);
          },
          handleLLMError: async (e) => {
            console.log('kangu');
            console.log(e);
          },
        }],
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

module.exports = {
  httpPrompt,
};
