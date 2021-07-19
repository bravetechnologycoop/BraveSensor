// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const { helpers, HistoricAlert, ALERT_TYPE } = require('brave-alert-lib')
const db = require('../../../db/db')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

describe('BraveAlerterConfigurator.js unit tests: getHistoricAlertsByAlertApiKey and createHistoricAlertFromRow', () => {
  beforeEach(() => {
    this.maxTimeAgoInMillis = 60000
    sandbox.stub(helpers, 'getEnvVar').withArgs('SESSION_RESET_THRESHOLD').returns(this.maxTimeAgoInMillis)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    this.braveAlerter = braveAlerterConfigurator.createBraveAlerter()
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('if there is a single result from db.getHistoricAlertsByAlertApiKey, returns an array containing a single HistoricAlert object with the returned data', async () => {
    const results = {
      id: 'id',
      display_name: 'displayName',
      incident_type: 'incidentType',
      alert_type: ALERT_TYPE.SENSOR_DURATION,
      created_at: new Date('2020-01-20T10:10:10.000Z'),
      responded_at: new Date('2020-01-20T10:12:40.000Z'),
    }
    sandbox.stub(db, 'getHistoricAlertsByAlertApiKey').returns([results])

    const historicAlerts = await this.braveAlerter.getHistoricAlertsByAlertApiKey('alertApiKey', 'maxHistoricAlerts')

    expect(historicAlerts).to.eql([
      new HistoricAlert(results.id, results.display_name, results.incident_type, results.alert_type, null, results.created_at, results.responded_at),
    ])
  })

  it('if there are multiple results from db.getHistoricAlertsByAlertApiKey, returns an array containing the HistoricAlert objects with the returned data', async () => {
    const results1 = {
      id: 'id1',
      display_name: 'displayName1',
      incident_type: 'incidentType1',
      alert_type: ALERT_TYPE.SENSOR_DURATION,
      created_at: new Date('2020-01-20T10:10:10.000Z'),
      responded_at: new Date('2020-01-20T10:12:40.000Z'),
    }
    const results2 = {
      id: 'id2',
      display_name: 'displayName2',
      incident_type: 'incidentType2',
      alert_type: ALERT_TYPE.SENSOR_NO_MOTION,
      created_at: new Date('2019-02-20T09:10:10.000Z'),
      responded_at: new Date('2019-02-20T09:12:40.000Z'),
    }
    sandbox.stub(db, 'getHistoricAlertsByAlertApiKey').returns([results1, results2])

    const historicAlerts = await this.braveAlerter.getHistoricAlertsByAlertApiKey('alertApiKey', 'maxHistoricAlerts')

    expect(historicAlerts).to.eql([
      new HistoricAlert(
        results1.id,
        results1.display_name,
        results1.incident_type,
        results1.alert_type,
        null,
        results1.created_at,
        results1.responded_at,
      ),
      new HistoricAlert(
        results2.id,
        results2.display_name,
        results2.incident_type,
        results2.alert_type,
        null,
        results2.created_at,
        results2.responded_at,
      ),
    ])
  })

  it('if there no results from db.getHistoricAlertsByAlertApiKey, returns an empty array', async () => {
    sandbox.stub(db, 'getHistoricAlertsByAlertApiKey').returns([])

    const historicAlerts = await this.braveAlerter.getHistoricAlertsByAlertApiKey('alertApiKey', 'maxHistoricAlerts')

    expect(historicAlerts).to.eql([])
  })

  it('if db.getHistoricAlertsByAlertApiKey returns a non-array, returns null', async () => {
    sandbox.stub(db, 'getHistoricAlertsByAlertApiKey').returns()

    const historicAlerts = await this.braveAlerter.getHistoricAlertsByAlertApiKey('alertApiKey', 'maxHistoricAlerts')

    expect(historicAlerts).to.be.null
  })

  it('db.getHistoricAlertsByAlertApiKey is called with the given alertApiKey, the given maxHistoricAlerts, and the SESSION_RESET_THRESHOLD from .env', async () => {
    sandbox.stub(db, 'getHistoricAlertsByAlertApiKey').returns()

    const alertApiKey = 'alertApiKey'
    const maxHistoricAlerts = 'maxHistoricAlerts'
    await this.braveAlerter.getHistoricAlertsByAlertApiKey(alertApiKey, maxHistoricAlerts)

    expect(db.getHistoricAlertsByAlertApiKey).to.be.calledWith(alertApiKey, maxHistoricAlerts, this.maxTimeAgoInMillis)
  })
})
