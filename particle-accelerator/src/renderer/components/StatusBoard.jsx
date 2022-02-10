import Button from 'react-bootstrap/Button'
import { Badge } from 'react-bootstrap'
import DeviceIDStatus from './DeviceIDStatus'
import ICCIDStatus from './ICCIDStatus'
import StatusBadge from './StatusBadge'

// CSS Styles
const styles = {
  main: {
    alignItems: 'top',
    display: 'flex',
    flexDirection: 'column',
  },
  child: {
    padding: 10,
  },
  scrollView: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'top',
    overflow: 'auto',
  },
}

/**
 * StatusBoard: React Component for displaying all of the statuses of the
 * current stages of the activation process.
 * @param props
 *    status (boolean): boolean for whether a first activation has taken place
 *                      yet or not.
 *    deviceID (string): the current state of deviceID acquisition or the actual
 *                       deviceID.
 *    iccid (string): the current state of iccid acquisition or the actual iccid
 *    activationStatus (string): the current state of SIM activation status
 *    renameStatus (string): the current status of renaming the Particle device
 *    totalStatus (string): the current status of the device activation
 *                          validation process.
 *    handleSubmit (any): function for handling the form submission process
 *    resetDefaults (any): function for resetting the form to a default state
 *    serialNumber (string): the user-inputted device serial number
 *    newDeviceName (string): the user-inputted name for the device
 * @effects
 * All of the string/boolean fields in props during when the
 * "next device" button is pressed (clears all fields)
 *
 * The list of ActivationAttempts when the "try again" button is pressed
 * (creates a new attempt)
 */
function StatusBoard(props) {
  // eslint-disable-next-line react/destructuring-assignment,react/prop-types
  const { status, deviceID, iccid, activationStatus, renameStatus, totalStatus, handleSubmit, resetDefaults, serialNumber, newDeviceName } = props
  return (
    <div style={styles.main}>
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
          <Button variant="primary" onClick={resetDefaults} disabled={!status}>
            Next Device
          </Button>
          <Button variant="warning" onClick={handleSubmit} disabled={!status}>
            Try Again
          </Button>
        </div>
      </div>
    </div>
  )
}

export default StatusBoard
