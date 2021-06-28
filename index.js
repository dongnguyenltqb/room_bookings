const moment = require("moment");
const { Transaction, QueryTypes } = require("sequelize");
const models = require("./models");
models.Instant.authenticate()
  .then(startProcess)
  .then(startProcessMulti)
  .then(() => process.exit(0))
  .catch((err) => console.log(err));

async function removeCommandFromOrder(order_id) {
  await models.Bookings.destroy({
    where: {
      order_id,
    },
  });
}

// return error || sucessful
async function book(room_id, start_time, end_time, order_id) {
  let t = await models.Instant.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
  });

  try {
    // aquire explicit lock
    await models.Instant.query(
      `select * from rooms where id = :room_id for update;`,
      {
        transaction: t,
        type: QueryTypes.SELECT,
        replacements: {
          room_id,
        },
      }
    );
    // check overlaptime
    let total = await models.Instant.query(
      `
        select * from bookings
        where room_id = :room_id
        and (not (
        (start_time > :end_time ) or (end_time < :start_time)
        ))
        limit 1;
      `,
      {
        transaction: t,
        type: QueryTypes.SELECT,
        replacements: {
          room_id,
          start_time,
          end_time,
        },
      }
    );
    if (total.length > 0) throw new Error(`${room_id} overlaptime`);

    // insert now
    await models.Bookings.create(
      {
        room_id,
        start_time,
        end_time,
        order_id,
      },
      {
        transaction: t,
      }
    );
    await t.commit();
    return true;
  } catch (err) {
    t.rollback();
    return err.message;
  }
}

async function startProcess() {
  let startTime = moment().unix();
  let n = 1000;
  let maxRoomCount = 12;
  let arrayOfPromises = [];
  for (let room_id = 1; room_id <= maxRoomCount; room_id++) {
    for (let i = 0; i < n; i++) {
      let start_time = moment().unix() + Math.floor(Math.random() * 100000000);
      let end_time = start_time + Math.floor(Math.random() * 6000000);

      start_time = moment(start_time * 1000).toISOString();
      end_time = moment(end_time * 1000).toISOString();

      arrayOfPromises.push(book(room_id, start_time, end_time, 1));
    }
  }

  await Promise.all(arrayOfPromises);

  console.log(
    `Process ${n * maxRoomCount} single command in ${
      moment().unix() - startTime
    } s`
  );
}

async function startProcessMulti() {
  let startTime = moment().unix();
  // n ís the number of order
  let n = 1000;
  let maxRoomCount = 12;
  let arrayOfNItems = [];
  for (let i = 1; i <= n; i++) arrayOfNItems.push(i);

  // process order
  let data = await Promise.all(
    arrayOfNItems.map(async (order_id) => {
      let commands = new Array(maxRoomCount + 1);
      // order include option from multi room
      for (let room_id = 1; room_id <= maxRoomCount; room_id++) {
        let start_time =
          moment().unix() + Math.floor(Math.random() * 10000000000);
        let end_time = start_time + Math.floor(Math.random() * 6000000);

        start_time = moment(start_time * 1000).toISOString();
        end_time = moment(end_time * 1000).toISOString();

        commands[room_id] = book(room_id, start_time, end_time, order_id);
      }
      // wait for process
      let commandResults = await Promise.all(commands);
      // check group command for order
      for (let room_id = 1; room_id <= maxRoomCount; room_id++)
        if (commandResults[room_id] !== true) {
          // depend on bussiness
          await removeCommandFromOrder(order_id);
          return false;
        }
      // all command sucessfully
      return true;
    })
  );

  let count = 0;
  for (let i = 0; i < data.length; i++) if (data[i]) count = count + 1;

  console.log(
    `Process ${n * maxRoomCount} multi command in ${
      moment().unix() - startTime
    } s, ${count} orders ok`
  );
}
