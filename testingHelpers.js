function getRandomInt(minValue, maxValue) {
  const min = Math.ceil(minValue)
  const max = Math.floor(maxValue)
  return Math.floor(Math.random() * (max - min) + min) // The maximum is exclusive and the minimum is inclusive
}

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min
}

module.exports = {
  getRandomArbitrary,
  getRandomInt,
}
