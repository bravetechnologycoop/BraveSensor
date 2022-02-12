import PropTypes from 'prop-types'
import LoginStatus from '../components/LoginStatus'
import LoginForm from '../components/LoginForm'

/**
 * LoginView: React Component that provides a login form for a user to login
 * through to access the ActivatorView.
 */
function LoginView(props) {
  const { changeToken } = props

  const { loginState } = props
  const { changeLoginState } = props

  return (
    <>
      <h2>Particle Accelerator</h2>
      <LoginStatus loginState={loginState} />
      <LoginForm changeToken={changeToken} changeLoginState={changeLoginState} />
    </>
  )
}

LoginView.propTypes = {
  changeToken: PropTypes.func,
  loginState: PropTypes.string,
  changeLoginState: PropTypes.func,
}

LoginView.defaultProps = {
  changeToken: () => {},
  loginState: '',
  changeLoginState: () => {},
}

export default LoginView
