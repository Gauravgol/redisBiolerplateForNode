const express = require("express");
const { initializeRedisClient, redisCacheMiddleware } = require("./src/middlewares/redis.middleware.js")

require("dotenv").config();
const { UserController } = require("./src/controller/user.controller.js");

const app = express();
app.use(express.json());

initializeRedisClient();

app.get("/api/v1/users", redisCacheMiddleware({
    options: {
        EX: 43200, // 12h
        NX: false, // write the data even if the key already exists
    },
}),
    UserController.getAll
);

app.get("/api/v1/users", UserController.getAll);

const port = 4000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});