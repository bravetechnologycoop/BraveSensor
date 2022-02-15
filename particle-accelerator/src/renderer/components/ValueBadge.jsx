import { Badge } from 'react-bootstrap'
import PropTypes from 'prop-types'

function ValueBadge(props) {
  const { value, bg } = props
  let localStyle = bg

  if (localStyle === 'true') {
    localStyle = 'success'
  } else if (localStyle === 'false') {
    localStyle = 'danger'
  }

  if (value === 'idle') {
    return <Badge bg="secondary">Waiting</Badge>
  } else if (value === '') {
    return <Badge bg="danger">Error</Badge>
  } else if (value === 'false') {
    return <Badge bg="danger">False</Badge>
  } else if (value === 'true') {
    return <Badge bg="success">True</Badge>
  } else if (value === 'never online') {
    return <Badge bg="danger">Never Online</Badge>
  } else if (value === 'none') {
    return <Badge bg="danger">None</Badge>
  } else if (value === 'not found') {
    return <Badge bg="danger">Device Not Found</Badge>
  } else if (localStyle !== '') {
    return <Badge bg={localStyle}>{value}</Badge>
  } else {
    return <Badge bg="success">{value}</Badge>
  }
}

ValueBadge.propTypes = {
  value: PropTypes.string,
  bg: PropTypes.string,
}

ValueBadge.defaultProps = {
  value: '',
  bg: '',
}

export default ValueBadge
