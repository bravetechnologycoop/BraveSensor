// index.js

const Client = require('./Client')
const ClientExtension = require('./ClientExtension')
const Device = require('./Device')
const Session = require('./Session')
const SensorsVital = require('./SensorsVital')

const ClientNew = require('./ClientNew')
const ClientExtensionNew = require('./ClientExtensionNew')
const DeviceNew = require('./DeviceNew')
const SessionNew = require('./SessionNew')
const EventNew = require('./EventNew')
const VitalNew = require('./VitalNew')
const NotificationNew = require('./NotificationNew')

module.exports = {
  Client,
  ClientExtension,
  Device,
  Session,
  SensorsVital,

  ClientNew,
  ClientExtensionNew,
  SessionNew,
  DeviceNew,
  EventNew,
  VitalNew,
  NotificationNew,
}
