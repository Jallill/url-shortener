const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const Redis = require('ioredis');
const { promisify } = require('util')
const {nanoid} = require('nanoid');



const options = {
  host: 'localhost',
  port: 6379,
  password: 'sOmE_sEcUrE_pAsS' 
};

const redisClient = new Redis(options);

process.env.PORT = 8080;
process.env.REDIS_TTL = 30;
process.env.BASE_URL = 'http://localhost:8080/';
process.env.MAX_GET_REQUESTS = 3;

app.use(bodyParser.json());

app.get('/:id', async (req, res) => {
  console.log('get called');
  // redis get
  try {
    const id = req.params.id;

    const response = await new Promise(async (resolve, reject) => {
      redisClient.multi();
      redisClient.hgetall(id, (err, value) => {
        if (err) {
          reject(err);
        }

        redisClient.hincrby(id, 'count', 1, (err, count) => {

          if (count >= process.env.MAX_GET_REQUESTS) {
            redisClient.del(id);
          }
        });
        
        resolve(value.url);
      });
    });
    if(response) {
      return res.redirect(301, response);
    }
    return res.status(404).send( { nothing: 'here' } );
  } catch (e) {
    return res.status(500).send( { error: 'server error' } );
  }
  
});

app.post('/', (req, res) => {
  // redis set
  const id = nanoid(6);

  try { 
    redisClient.hmset(id, {url: req.body.url, count: 0}, (err) => {
      if (err) {
        throw err;
      }
      redisClient.expire(id, process.env.REDIS_TTL * 60 * 60 * 24);
    });
  } catch (e) {
    return res.status(500).send( {error: e });
  }
  return res.status(200).send({url: `${process.env.BASE_URL}${id}`});
});

app.listen(process.env.PORT, () => console.log(`Listening on port ${process.env.PORT}`));