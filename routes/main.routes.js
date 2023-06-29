const express = require('express');

const  {
    httpPrompt
} = require('../controllers/main.controller')

const mainRouter = express.Router()

mainRouter.post('/', httpPrompt)

module.exports = mainRouter;