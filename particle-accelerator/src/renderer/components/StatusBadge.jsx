import { Badge } from 'react-bootstrap'
import PropTypes from 'prop-types'

/**
 * StatusBadge: React component for displaying the current status of a process.
 * Outputs a badge based on the state of the status inputted.
 * @param props
 * status (string): current status of a process
 *
 * Supported Statuses and Corresponding Badges:
 *    - 'idle' -> Grey "Waiting"
 *    - 'waiting' -> Yellow "In Progress"
 *    - 'true' -> Green "Success"
 *    - else -> Red "Error"
 */
function StatusBadge(props) {
  const { status } = props
  if (status === 'idle') {
    return <Badge bg="secondary">Waiting</Badge>
  }
  if (status === 'waiting') {
    return <Badge bg="warning">In Progress</Badge>
  }
  if (status === 'true') {
    return <Badge bg="success">Success</Badge>
  }
  return <Badge bg="danger">Error</Badge>
}

StatusBadge.propTypes = {
  status: PropTypes.string,
}

StatusBadge.defaultProps = {
  status: '',
}

export default StatusBadge
