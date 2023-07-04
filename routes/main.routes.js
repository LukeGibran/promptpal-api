const express = require('express');

const  {
    httpLangChainPrompt,
    httpGPT3Prompt,
    httpGPTPrompt
} = require('../controllers/main.controller')

const mainRouter = express.Router()

mainRouter.post('/', httpLangChainPrompt)
mainRouter.get('/gpt', httpGPTPrompt)
mainRouter.post('/gpt3', httpGPT3Prompt)

module.exports = mainRouter;