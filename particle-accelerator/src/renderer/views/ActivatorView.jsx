import { useEffect, useState } from 'react'
import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'
import { Badge, Card } from 'react-bootstrap'
import PropTypes from 'prop-types'

import ActivationAttempt from '../utilities/ActivationAttempt'
import WelcomeText from '../components/WelcomeText'
import StatusBadge from '../components/StatusBadge'
import DeviceIDStatus from '../components/DeviceIDStatus'
import ICCIDStatus from '../components/ICCIDStatus'
import LogoutButton from '../components/LogoutButton'

const { getDeviceInfo } = require('../utilities/ParticleFunctions')

const { getProducts } = require('../utilities/ParticleFunctions')

const { activateDeviceSIM } = require('../utilities/ParticleFunctions')

const { changeDeviceName } = require('../utilities/ParticleFunctions')

const { verifyDeviceRegistration } = require('../utilities/ParticleFunctions')

// CSS Styles
const styles = {
  main: {
    display: 'flex',
    height: '75vh',
    justifyContent: 'center',
  },
  form: {
    flex: 3,
    order: 1,
    padding: 20,
    alignItems: 'top',
    display: 'flex',
    flexDirection: 'column',
  },
  statuses: {
    flex: 3.5,
    order: 2,
    padding: 20,
    alignItems: 'top',
    display: 'flex',
    flexDirection: 'column',
  },
  log: {
    flex: 3,
    order: 3,
    padding: 20,
    alignItems: 'top',
    display: 'flex',
    flexDirection: 'column',
  },
  scrollView: {
    overflow: 'auto',
    paddingRight: '5px',
    paddingLeft: '5px',
    paddingBottom: '5px',
  },
  child: {
    padding: 10,
  },
}

/**
 * ActivatorView: React component that displays:
 *                1. The user input form for device activation
 *                2. Device activation statuses
 *                3. Device activation log.
 */
function ActivatorView(props) {
  const { token, changeToken, changeLoginState } = props

  const blankActivationArray = []

  const [productList, setProductList] = useState([])
  const [serialNumber, setSerialNumber] = useState('')
  const [deviceID, setDeviceID] = useState('idle')
  const [iccid, setICCID] = useState('idle')
  const [country, setCountry] = useState('')
  const [productID, setProductID] = useState('')
  const [activationStatus, setActivationStatus] = useState('idle')
  const [newDeviceName, setNewDeviceName] = useState('')
  const [renameStatus, setRenameStatus] = useState('idle')
  const [totalStatus, setTotalStatus] = useState('idle')
  const [statusView, setStatusView] = useState(false)
  const [formLock, setFormLock] = useState(false)
  const [attemptList, setAttemptList] = useState(blankActivationArray)

  async function pushAttempt(newAttempt) {
    const newAttemptArray = [newAttempt]
    setAttemptList(newAttemptArray.concat(attemptList))
  }

  async function resetDefaults() {
    setSerialNumber('')
    setDeviceID('idle')
    setICCID('idle')
    setCountry('')
    setProductID('')
    setActivationStatus('idle')
    setNewDeviceName('')
    setRenameStatus('idle')
    setTotalStatus('idle')
    setStatusView(false)
    setFormLock(false)
  }

  useEffect(() => {
    async function fetchUserInfo() {
      const response = await getProducts(token)
      setProductList(response)
    }
    fetchUserInfo()
  }, [token])

  async function handleSubmit(event) {
    setFormLock(true)

    let totalStatusCopy = 'idle'
    let deviceIDCopy = 'idle'
    let iccidCopy = 'idle'
    let activationStatusCopy = 'idle'
    let renameStatusCopy = 'idle'

    event.preventDefault()
    setStatusView(true)

    setDeviceID('waiting')
    deviceIDCopy = 'waiting'
    setICCID('waiting')
    iccidCopy = 'waiting'
    const deviceInfo = await getDeviceInfo(serialNumber, token)
    setDeviceID(deviceInfo.deviceID)
    deviceIDCopy = deviceInfo.deviceID
    setICCID(deviceInfo.iccid)
    iccidCopy = deviceInfo.iccid

    if (!iccidCopy) {
      iccidCopy = 'error'
    }

    if (!deviceIDCopy) {
      deviceIDCopy = 'error'
    }

    setActivationStatus('waiting')
    activationStatusCopy = 'waiting'
    const SIMStatus = await activateDeviceSIM(deviceInfo.iccid, country, `${productID}`, token)
    if (SIMStatus) {
      setActivationStatus('true')
      activationStatusCopy = 'true'
    } else {
      setActivationStatus('error')
      activationStatusCopy = 'error'
    }

    setRenameStatus('waiting')
    renameStatusCopy = 'waiting'

    setDeviceID(deviceInfo.deviceID)
    const rename = await changeDeviceName(deviceInfo.deviceID, productID, newDeviceName, token)

    if (rename) {
      setRenameStatus('true')
      renameStatusCopy = 'true'
    } else {
      setRenameStatus('error')
      renameStatusCopy = 'error'
    }

    setTotalStatus('waiting')
    totalStatusCopy = 'waiting'

    const finalVerification = await verifyDeviceRegistration(deviceInfo.deviceID, newDeviceName, productID, deviceInfo.iccid, serialNumber, token)

    if (finalVerification) {
      setTotalStatus('true')
      totalStatusCopy = 'true'
    } else {
      setTotalStatus('false')
      totalStatusCopy = 'false'
    }

    pushAttempt(
      new ActivationAttempt(
        serialNumber,
        newDeviceName,
        productID,
        deviceIDCopy,
        iccidCopy,
        country,
        activationStatusCopy,
        renameStatusCopy,
        totalStatusCopy,
      ),
    )
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return (
    <div style={{ padding: '10px' }}>
      <div style={{ textAlign: 'center' }}>
        <h2>
          <WelcomeText token={token} /> <LogoutButton token={token} changeToken={changeToken} changeLoginState={changeLoginState}/>
        </h2>
      </div>

      <div style={styles.main}>
        <div style={styles.form}>
          <div>
            <h3>Device Details</h3>
            <hr />
          </div>
          <div style={styles.scrollView}>
            {/* eslint-disable-next-line react/jsx-no-bind */}
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="formDeviceID">
                <Form.Label>Device Serial Number</Form.Label>
                <Form.Control
                  disabled={formLock}
                  placeholder="Enter ID"
                  value={serialNumber}
                  maxLength="15"
                  onChange={x => setSerialNumber(x.target.value)}
                />
                <Form.Text className="text-muted">This is retrieved by scanning the barcode on the particle device.</Form.Text>
              </Form.Group>

              <Form.Group className="mb-3" controlId="formNewName">
                <Form.Label>New Device Name</Form.Label>
                <Form.Control disabled={formLock} placeholder="Device Name" value={newDeviceName} onChange={x => setNewDeviceName(x.target.value)} />
                <Form.Text className="text-muted">Enter the name to be displayed on the Particle Console.</Form.Text>
              </Form.Group>

              <Form.Group className="mb-3" controlId="formProductSelect">
                <Form.Label>Select Device Product Family</Form.Label>
                <Form.Control
                  disabled={formLock}
                  as="select"
                  value={productID}
                  onChange={x => {
                    setProductID(x.target.value)
                  }}
                >
                  <option id="">No Product Family</option>
                  {productList.map(product => {
                    return (
                      <option key={`${product.id}`} id={`${product.id}`} value={`${product.id}`}>
                        {`${product.id}`.concat(': ', product.name, ' (', product.deviceType, ')')}
                      </option>
                    )
                  })}
                </Form.Control>
              </Form.Group>

              <Form.Group className="mb-3" controlId="formCountrySelect">
                <Form.Label>Select Country for SIM Activation</Form.Label>
                <Form.Control
                  disabled={formLock}
                  as="select"
                  value={country}
                  onChange={x => {
                    setCountry(x.target.value)
                  }}
                >
                  <option id="XXX" value="">
                    Select Country
                  </option>
                  <option id="CAN" value="CAN">
                    Canada
                  </option>
                  <option id="USA" value="USA">
                    United States
                  </option>
                </Form.Control>
              </Form.Group>

              <Button variant="primary" type="submit" disabled={formLock}>
                Submit
              </Button>
            </Form>
          </div>
        </div>

        <div style={styles.statuses}>
          <div>
            <h3>Current Activation Progress</h3>
            <hr />
          </div>
          <div style={styles.scrollView}>
            <div style={styles.child}>
              <h5>Device Information:</h5>
              Device Serial Number: <Badge bg="primary">{serialNumber}</Badge>
              <br />
              New Device Name: <Badge bg="primary">{newDeviceName}</Badge>
            </div>
            <div style={styles.child}>
              Device ID: <DeviceIDStatus deviceID={deviceID} />
              <br />
              ICCID: <ICCIDStatus iccid={iccid} />
            </div>

            <div style={styles.child}>
              <h5>SIM Activation:</h5>
              Status: <StatusBadge status={activationStatus} />
            </div>

            <div style={styles.child}>
              <h5>Device Naming:</h5>
              Status: <StatusBadge status={renameStatus} />
            </div>

            <div style={styles.child}>
              <h5>Activation Verification:</h5>
              Status: <StatusBadge status={totalStatus} />
            </div>

            <div style={styles.child}>
              {/* eslint-disable-next-line react/jsx-no-bind */}
              <Button variant="primary" onClick={resetDefaults} disabled={!statusView}>
                Next Device
              </Button>
              {/* eslint-disable-next-line react/jsx-no-bind */}
              <Button variant="warning" onClick={handleSubmit} disabled={!statusView}>
                Try Again
              </Button>
            </div>
          </div>
        </div>

        <div style={styles.log}>
          <div>
            <h3>Activation History</h3>
            <hr />
          </div>
          <div style={styles.scrollView}>
            {attemptList.map(attempt => {
              return (
                <li key={`${attempt.timeStamp}`}>
                  <Card key={`${attempt.timeStamp}`}>
                    <Card.Body>
                      <Card.Title>{attempt.deviceName}</Card.Title>
                      <Card.Subtitle>{`${attempt.timeStamp.toLocaleDateString()} ${attempt.timeStamp.toLocaleTimeString()}`}</Card.Subtitle>
                      Activation: <StatusBadge status={attempt.totalStatus} />
                      <br />
                      Serial Number: <Badge bg="primary">{attempt.serialNumber}</Badge>
                      <br />
                      Product: <Badge bg="primary">{attempt.productID}</Badge>
                      <br />
                      Country: <Badge bg="primary">{attempt.country}</Badge>
                      <br />
                      Device ID: <DeviceIDStatus deviceID={attempt.deviceID} />
                      <br />
                      ICCID: <ICCIDStatus iccid={attempt.iccid} />
                      <br />
                      SIM Activation Status: <StatusBadge status={attempt.SIMActivationStatus} />
                      <br />
                      Rename Status: <StatusBadge status={attempt.namingStatus} />
                    </Card.Body>
                  </Card>
                </li>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

ActivatorView.propTypes = {
  token: PropTypes.string,
  changeToken: PropTypes.func,
  changeLoginState: PropTypes.func,
}

ActivatorView.defaultProps = {
  token: '',
  changeToken: () => {},
  changeLoginState: () => {},
}

export default ActivatorView
