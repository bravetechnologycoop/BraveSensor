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
      {/* eslint-disable-next-line react/jsx-no-constructed-context-values */}
      <LoginContext.Provider value={{ loginState, setLoginState }}>
        {/* eslint-disable-next-line react/jsx-no-constructed-context-values */}
        <TokenContext.Provider value={{ token, setToken }}>
          <LoginStatus />
        </TokenContext.Provider>
        {/* eslint-disable-next-line react/jsx-no-constructed-context-values */}
        <TokenContext.Provider value={{ token, setToken }}>
          <LoginForm />
        </TokenContext.Provider>
      </LoginContext.Provider>
    </>
  )
}
