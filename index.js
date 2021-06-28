const models = require("./models");
models.Instant.authenticate()
  .then((data) => startProcess())
  .catch((err) => console.log(err));

async function booking(room_id, start_time, end_time, order_id) {}

async function startProcess() {}
