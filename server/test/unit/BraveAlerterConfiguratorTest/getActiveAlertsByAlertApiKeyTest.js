// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const { helpers, ActiveAlert, ALERT_TYPE, CHATBOT_STATE } = require('brave-alert-lib')
const db = require('../../../db/db')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

describe('BraveAlerterConfigurator.js unit tests: getActiveAlertsByAlertApiKey and createActiveAlertFromRow', () => {
  beforeEach(() => {
    this.maxTimeAgoInMillis = 60000
    sandbox.stub(helpers, 'getEnvVar').withArgs('SESSION_RESET_THRESHOLD').returns(this.maxTimeAgoInMillis)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    this.braveAlerter = braveAlerterConfigurator.createBraveAlerter()
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('if there is a single result from db.getActiveAlertsByAlertApiKey, returns an array containing a single ActiveAlert object with the returned data', async () => {
    const results = {
      id: 'id',
      chatbot_state: CHATBOT_STATE.RESPONDING,
      display_name: 'displayName',
      alert_type: ALERT_TYPE.SENSOR_DURATION,
      created_at: new Date('2020-01-20T10:10:10.000Z'),
    }
    sandbox.stub(db, 'getActiveAlertsByAlertApiKey').returns([results])

    const activeAlerts = await this.braveAlerter.getActiveAlertsByAlertApiKey('alertApiKey')

    expect(activeAlerts).to.eql([
      new ActiveAlert(
        results.id,
        results.chatbot_state,
        results.display_name,
        results.alert_type,
        ['No One Inside', 'Person responded', 'Overdose', 'None of the above'],
        results.created_at,
      ),
    ])
  })

  it('if there are multiple results from db.getActiveAlertsByAlertApiKey, returns an array containing the ActiveAlert objects with the returned data', async () => {
    const results1 = {
      id: 'id1',
      chatbot_state: CHATBOT_STATE.WAITING_FOR_CATEGORY,
      display_name: 'displayName1',
      alert_type: ALERT_TYPE.SENSOR_DURATION,
      created_at: new Date('2020-01-20T10:10:10.000Z'),
    }
    const results2 = {
      id: 'id2',
      chatbot_state: CHATBOT_STATE.RESPONDING,
      display_name: 'displayName2',
      alert_type: ALERT_TYPE.SENSOR_STILLNESS,
      created_at: new Date('2019-02-20T09:10:10.000Z'),
    }
    sandbox.stub(db, 'getActiveAlertsByAlertApiKey').returns([results1, results2])

    const activeAlerts = await this.braveAlerter.getActiveAlertsByAlertApiKey('alertApiKey')

    expect(activeAlerts).to.eql([
      new ActiveAlert(
        results1.id,
        results1.chatbot_state,
        results1.display_name,
        results1.alert_type,
        ['No One Inside', 'Person responded', 'Overdose', 'None of the above'],
        results1.created_at,
      ),
      new ActiveAlert(
        results2.id,
        results2.chatbot_state,
        results2.display_name,
        results2.alert_type,
        ['No One Inside', 'Person responded', 'Overdose', 'None of the above'],
        results2.created_at,
      ),
    ])
  })

  it('if there no results from db.getActiveAlertsByAlertApiKey, returns an empty array', async () => {
    sandbox.stub(db, 'getActiveAlertsByAlertApiKey').returns([])

    const activeAlerts = await this.braveAlerter.getActiveAlertsByAlertApiKey('alertApiKey')

    expect(activeAlerts).to.eql([])
  })

  it('if db.getActiveAlertsByAlertApiKey returns a non-array, returns null', async () => {
    sandbox.stub(db, 'getActiveAlertsByAlertApiKey').returns()

    const activeAlerts = await this.braveAlerter.getActiveAlertsByAlertApiKey('alertApiKey')

    expect(activeAlerts).to.be.null
  })

  it('db.getActiveAlertsByAlertApiKey is called with the given alertApiKey and the SESSION_RESET_THRESHOLD from .env', async () => {
    sandbox.stub(db, 'getActiveAlertsByAlertApiKey').returns()

    const alertApiKey = 'alertApiKey'
    await this.braveAlerter.getActiveAlertsByAlertApiKey(alertApiKey)

    expect(db.getActiveAlertsByAlertApiKey).to.be.calledWith(alertApiKey, this.maxTimeAgoInMillis)
  })
})
