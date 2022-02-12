import './App.css'
import 'bootstrap/dist/css/bootstrap.min.css'

import { useState } from 'react';
import TokenContext from './utilities/TokenContext'
import LoginContext from './utilities/LoginContext'
import LoginView from './views/LoginView'
import ActivatorView from './views/ActivatorView'

export default function App() {
  const [token, setToken] = useState(null)
  const [loginState, setLoginState] = useState('false')

  if (token === null) {
    return (
      <div>
        {/* eslint-disable-next-line react/jsx-no-constructed-context-values */}
        <LoginContext.Provider value={{ loginState, setLoginState }}>
          {/* eslint-disable-next-line react/jsx-no-constructed-context-values */}
          <TokenContext.Provider value={{ token, setToken }}>
            <LoginView />
          </TokenContext.Provider>
        </LoginContext.Provider>
      </div>
    )
  }
  return (
    <div>
      {/* eslint-disable-next-line react/jsx-no-constructed-context-values */}
      <LoginContext.Provider value={{ loginState, setLoginState }}>
        {/* eslint-disable-next-line react/jsx-no-constructed-context-values */}
        <TokenContext.Provider value={{ token, setToken }}>
          <ActivatorView />
        </TokenContext.Provider>
      </LoginContext.Provider>
    </div>
  )
}
