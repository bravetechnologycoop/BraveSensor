/*
React component for displaying the current status of acquiring
an iccid. Outputs a badge with either the current status of iccid acquisition
or a badge with the iccid if a valid iccid is returned.
 */

import { Badge } from 'react-bootstrap'
import PropTypes from 'prop-types'

/**
 * Checks that the iccid is valid based on a regex expression (starts with
 * 89 and has 18 characters in length).
 * @param iccid
 * @return true if the iccid is valid, false if not.
 */
function checkValidICCID(iccid) {
  const regex = /^(89).{18}$/
  return regex.test(iccid)
}

/**
 * React component for displaying the current status of acquiring
 * an iccid. Outputs a badge with either the current status of iccid acquisition
 * or a badge with the iccid if a valid iccid is returned.
 * @param props
 * iccid (string): the current state or iccid of the current activating
 *                    device.
 */
function ICCIDStatus(props) {
  const { iccid } = props
  if (iccid === 'idle') {
    return <Badge bg="secondary">Waiting</Badge>
  }
  if (iccid === 'waiting') {
    return <Badge bg="warning">In Progress</Badge>
  }
  if (checkValidICCID(iccid)) {
    return <Badge bg="success">{iccid}</Badge>
  }
  return <Badge bg="danger">Error in Acquiring ICCID</Badge>
}

ICCIDStatus.propTypes = {
  iccid: PropTypes.string,
}

ICCIDStatus.defaultProps = {
  iccid: '',
}

export default ICCIDStatus
