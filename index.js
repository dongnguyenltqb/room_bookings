const moment = require("moment");
const { Transaction, QueryTypes } = require("sequelize");
const models = require("./models");
models.Instant.authenticate()
  .then(() => startProcess())
  .catch((err) => console.log(err));

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
    `Process ${n * maxRoomCount} command in ${moment().unix() - startTime} s`
  );
}
