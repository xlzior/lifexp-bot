const { pool, getRows } = require("./postgresql");

const getAll = userId => {
  return pool.query("SELECT * FROM achievements WHERE user_id=$1", [userId]).then(getRows);
};

const defaultAchievement = (userId, type) => ({
  user_id: userId,
  type,
  level: 0,
});

const get = async (userId, type) => {
  const res = await pool.query(
    "SELECT * FROM achievements WHERE user_id=$1 AND type=$2",
    [userId, type]);
  const rows = getRows(res);
  return rows.length > 0 ? rows[0] : defaultAchievement(userId, type);
};

const update = (userId, type, level) => {
  return pool.query(
    `INSERT INTO achievements(user_id, type, level) VALUES($1, $2, $3)
    ON CONFLICT (user_id, type)
    DO UPDATE SET level=$3 WHERE achievements.user_id=$1 AND achievements.type=$2;`,
    [userId, type, level]);
};

module.exports = {
  getAll,
  get,
  update,
};
