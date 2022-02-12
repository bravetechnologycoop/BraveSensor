import { Badge } from 'react-bootstrap'
import PropTypes from 'prop-types'

/**
 * LoginStatus: React component for displaying the current login state of the
 * application. Outputs a badge based on the value of the loginState context
 * hook.
 */
function LoginStatus(props) {
  const { loginState } = props

  if (loginState === 'waiting') {
    return (
      <div>
        <h4>
          <Badge bg="warning">Authentication in Progress</Badge>
        </h4>
      </div>
    )
  }
  if (loginState === 'passwordincorrect') {
    return (
      <div>
        <h4>
          <Badge bg="danger">Authentication Error</Badge>
        </h4>
      </div>
    )
  }
  if (loginState === 'true') {
    return (
      <div>
        <h4>
          <Badge bg="success">Authenticated</Badge>
        </h4>
      </div>
    )
  }
  return (
    <div>
      <h4>
        <Badge bg="danger">Not Authenticated</Badge>
      </h4>
    </div>
  )
}

LoginStatus.propTypes = {
  loginState: PropTypes.string,
}

LoginStatus.defaultProps = {
  loginState: '',
}

export default LoginStatus
