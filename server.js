const http = require('http');
require('dotenv').config();
const morgan = require('morgan')
const fs = require('fs')
const path = require('path')

const express = require('express');
const app = express();

const helmet = require('helmet')
const xss = require('xss-clean')
const hpp = require('hpp')
const compression = require('compression')
const cors = require('cors');

const SERVER_PORT = process.env.SERVER_PORT;

const mainRouter = require('./routes/main.routes');


app.use(helmet())
app.use(xss())
app.use(hpp())

app.use(
  cors({
    origin: "*",
    optionsSuccessStatus: 200
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression())

var accessLogStream = fs.createWriteStream(path.join(__dirname, "access.log"), {
  flags: "a",
});

morgan.token("body", (req) => {
  return JSON.stringify(req.body);
});

app.use(
  morgan(
    ":method :url :status :response-time ms - :res[content-length] :body",
    { stream: accessLogStream }
  )
);

if (process.env.NODE_ENV === 'dev') {
    app.use(morgan('dev'))
}

app.use('/prompt', mainRouter);

const server = http.createServer(app);

server.listen(SERVER_PORT, (err) => {
    if(err) {
        throw err;
    }

    console.log(`Listening on port ${SERVER_PORT}`)
})