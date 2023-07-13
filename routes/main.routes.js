const express = require('express');
const multerHelper = require('../helpers/upload')

const  {
    httpLangChainPrompt,
    httpChatFileStream,
    httpUploadFile,
    httpGPT3Prompt,
    httpGPTPrompt,
    httpChatFile
} = require('../controllers/main.controller')

const mainRouter = express.Router()

// mainRouter.post('/', httpLangChainPrompt)
// mainRouter.get('/gpt', httpGPTPrompt)
// mainRouter.post('/chatfile', httpChatFile)

mainRouter.get('/gpt3', httpGPT3Prompt)
mainRouter.get('/chatfile', httpChatFileStream)
mainRouter.post('/upload', multerHelper.upload.single('file'), httpUploadFile)

module.exports = mainRouter;