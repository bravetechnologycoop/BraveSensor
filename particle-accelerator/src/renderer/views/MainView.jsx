import PropTypes from 'prop-types'
import { ButtonGroup, ToggleButton } from 'react-bootstrap'
import { useState } from 'react'
import WelcomeText from '../components/WelcomeText'
import LogoutButton from '../components/LogoutButton'
import ActivatorView from './ActivatorView'
import Validator from '../components/Validator'

const styles = {
  main: {
    display: 'flex',
    height: '75vh',
    width: '90vw',
    justifyContent: 'center',
  },
}

function MainView(props) {
  const { token, changeToken, changeLoginState } = props
  const [viewMode, setViewMode] = useState('activator')
  let view = <ActivatorView token={token} />

  if (viewMode === 'activator') {
    view = <ActivatorView token={token} />
  }

  if (viewMode === 'validator') {
    view = <Validator token={token} />
  }

  return (
    <div style={{ padding: '10px' }}>
      <div style={{ textAlign: 'center' }}>
        <h2>
          <WelcomeText token={token} /> <LogoutButton token={token} changeToken={changeToken} changeLoginState={changeLoginState} />
        </h2>
        <ButtonGroup className="mb-2">
          <ToggleButton
            key={0}
            id="activator"
            type="radio"
            variant="primary"
            value="activator"
            checked={viewMode === 'activator'}
            onChange={x => setViewMode(x.target.value)}
          >
            Activator
          </ToggleButton>
          <ToggleButton
            key={1}
            id="validator"
            type="radio"
            variant="primary"
            value="validator"
            checked={viewMode === 'validator'}
            onChange={x => setViewMode(x.target.value)}
          >
            Validator
          </ToggleButton>
        </ButtonGroup>
      </div>

      <div style={styles.main}>{view}</div>
    </div>
  )
}

MainView.propTypes = {
  token: PropTypes.string,
  changeToken: PropTypes.func,
  changeLoginState: PropTypes.func,
}

MainView.defaultProps = {
  token: '',
  changeToken: () => {},
  changeLoginState: () => {},
}

export default MainView
