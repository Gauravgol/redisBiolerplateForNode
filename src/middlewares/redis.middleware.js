const hash = require('object-hash');

const { createClient } = require("redis");
let redisClient = undefined;

exports.initializeRedisClient = async () => {

    let redisURL = process.env.REDIS_URI
    if (redisURL) {

        redisClient = createClient({ url: redisURL }).on("error", (e) => {
            console.error(`Failed to create the Redis client with error:`);
            console.error(e);
        });

        try {
            // connect to the Redis server
            await redisClient.connect();
            console.log(`Connected to Redis successfully!`);
        } catch (e) {
            console.error(`Connection to Redis failed with error:`);
            console.error(e);
        }
    }
}
function requestToKey(req) {
    // build a custom object to use as part of the Redis key
    const reqDataToHash = {
        query: req.query,
        body: req.body,
    };

    // `${req.path}@...` to make it easier to find
    // keys on a Redis client
    return `${req.path}@${hash.sha1(reqDataToHash)}`;
}
function isRedisWorking() {
    // verify wheter there is an active connection
    // to a Redis server or not
    return !!redisClient?.isOpen;
}
async function writeData(key, data, options) {
    if (isRedisWorking()) {
        try {
            // write data to the Redis cache
            await redisClient.set(key, data, options);
        } catch (e) {
            console.error(`Failed to cache data for key=${key}`, e);
        }
    }
}
async function readData(key) {
    let cachedValue = undefined;

    if (isRedisWorking()) {
        // try to get the cached response from redis
        cachedValue = await redisClient.get(key);
        if (cachedValue) {
            return cachedValue;
        }
    }
}

exports.redisCacheMiddleware = (
    options = {
        EX: 21600, // 6h
    }
) => {
    return async (req, res, next) => {
        if (isRedisWorking()) {
            const key = requestToKey(req);
            // if there is some cached data, retrieve it and return it
            const cachedValue = await readData(key);
            if (cachedValue) {
                try {
                    // if it is JSON data, then return it
                    return res.json(JSON.parse(cachedValue));
                } catch {
                    // if it is not JSON data, then return it
                    return res.send(cachedValue);
                }
            } else {
                // override how res.send behaves
                // to introduce the caching logic
                const oldSend = res.send;
                res.send = function (data) {
                    // set the function back to avoid the 'double-send' effect
                    res.send = oldSend;

                    // cache the response only if it is successful
                    if (res.statusCode.toString().startsWith("2")) {
                        writeData(key, data, options).then();
                    }

                    return res.send(data);
                };

                // continue to the controller function
                next();
            }
        } else {
            // proceed with no caching
            next();
        }
    };
}



