const generateCustomId = async (Model, idField, prefix) => {
  const records = await Model.find({}, { [idField]: 1, _id: 0 }).sort({
    [idField]: 1,
  });

  const ids = records
    .map((record) => {
      if (record[idField]) {
        return parseInt(record[idField].replace(prefix, ""), 10);
      }
      return null;
    })
    .filter((id) => id !== null);

  let newId = 1;
  for (let i = 0; i < ids.length; i++) {
    if (newId < ids[i]) {
      break;
    }
    newId++;
  }

  return `${prefix}${String(newId).padStart(4, "0")}`;
};

module.exports = generateCustomId;
