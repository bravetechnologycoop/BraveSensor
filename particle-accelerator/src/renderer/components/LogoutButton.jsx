import { useContext } from 'react'
import Button from 'react-bootstrap/Button'
import TokenContext from '../utilities/TokenContext'
import LoginContext from '../utilities/LoginContext'

/**
 * LogoutButton: React component (button) for resetting the token and loginState
 * to default/null values.
 * @effects the global token variable and the global loginState variable
 */
function LogoutButton() {
  const { setToken, token } = useContext(TokenContext)
  function changeToken(newToken) {
    setToken(newToken)
  }

  const { setLoginState } = useContext(LoginContext)
  function changeLoginState(newState) {
    setLoginState(newState)
  }

  let disabledStatus = true

  if (token !== null) {
    disabledStatus = false
  }

  return (
    <div>
      <Button
        variant="danger"
        onClick={() => {
          changeLoginState('false')
          changeToken(null)
        }}
        disabled={disabledStatus}
        size="sm"
      >
        Logout
      </Button>
    </div>
  )
}

export default LogoutButton
