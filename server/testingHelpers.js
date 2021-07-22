const { fill } = require('lodash')

function getRandomInt(minValue, maxValue) {
  const min = Math.ceil(minValue)
  const max = Math.floor(maxValue)
  return Math.floor(Math.random() * (max - min) + min) // The maximum is exclusive and the minimum is inclusive
}

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min
}

function printRandomIntArray(min, max, length) {
  const intArray = fill(Array(length), getRandomInt(min, max))
  return intArray.join(', ')
}

function randomXethruStream(fastmin, fastmax, slowmin, slowmax, length) {
  const array = fill(Array(length), { mov_f: getRandomInt(fastmin, fastmax), mov_s: getRandomInt(slowmin, slowmax) })
  return array
}

function randomInnosentStream(min, max, length) {
  const array = fill(Array(length), { inPhase: getRandomInt(min, max) })
  return array
}

module.exports = {
  getRandomArbitrary,
  getRandomInt,
  printRandomIntArray,
  randomXethruStream,
  randomInnosentStream,
}
