/*
DeviceIDStatus: React component for displaying the current status of acquiring
a DeviceID. Outputs a badge with either the current status of ID acquisition or
a badge with the DeviceID if a valid DeviceID is returned.
 */

import { Badge } from 'react-bootstrap'

/**
 * Checks that the deviceID is valid based on a regex expression (contains
 * only hex characters and is 24 characters in length).
 * @param deviceID
 * @return true if the deviceID is valid, false if not.
 */
async function checkValidDeviceID(deviceID) {
  const regex = /^[0-9|a-f]{24}$/
  return regex.test(deviceID)
}

/**
 * React component for displaying the current status of acquiring
 * a DeviceID. Outputs a badge with either the current status of ID acquisition
 * or a badge with the DeviceID if a valid DeviceID is returned.
 * @param props
 * deviceID (string): the current state or deviceID of the current activating
 *                    device.
 */
function DeviceIDStatus(props) {
  // eslint-disable-next-line react/prop-types
  const { deviceID } = props
  if (deviceID === 'idle') {
    return <Badge bg="secondary">Waiting</Badge>
  }
  if (deviceID === 'waiting') {
    return <Badge bg="warning">In Progress</Badge>
  }
  if (checkValidDeviceID(deviceID)) {
    return <Badge bg="success">{deviceID}</Badge>
  }
  return <Badge bg="danger">Error in Acquiring Device ID</Badge>
}

export default DeviceIDStatus
