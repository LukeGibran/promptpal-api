const express = require('express');

const  {
    httpLangChainPrompt,
    httpGPTPrompt
} = require('../controllers/main.controller')

const mainRouter = express.Router()

mainRouter.post('/', httpLangChainPrompt)
mainRouter.get('/gpt', httpGPTPrompt)

module.exports = mainRouter;