/* eslint-disable react/jsx-no-constructed-context-values */

import { useContext } from 'react'
import LoginContext from '../utilities/LoginContext'
import TokenContext from '../utilities/TokenContext'
import LoginStatus from '../components/LoginStatus'
import LoginForm from '../components/LoginForm'

/**
 * LoginView: React Component that provides a login form for a user to login
 * through to access the ActivatorView.
 */
export default function LoginView() {
  const { setToken, token } = useContext(TokenContext)
  const { setLoginState, loginState } = useContext(LoginContext)

  return (
    <>
      <h2>Particle Accelerator</h2>
      <LoginContext.Provider value={{ loginState, setLoginState }}>
        <TokenContext.Provider value={{ token, setToken }}>
          <LoginStatus />
        </TokenContext.Provider>
        <TokenContext.Provider value={{ token, setToken }}>
          <LoginForm />
        </TokenContext.Provider>
      </LoginContext.Provider>
    </>
  )
}
