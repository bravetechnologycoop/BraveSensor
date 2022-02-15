import './App.css'
import 'bootstrap/dist/css/bootstrap.min.css'

import { useState } from 'react'
import LoginView from './views/LoginView'
import ActivatorView from './views/ActivatorView'
import MainView from './views/MainView';

export default function App() {
  const [token, setToken] = useState('')
  const [loginState, setLoginState] = useState('false')

  function changeToken(newToken) {
    setToken(newToken)
  }

  function changeLoginState(newState) {
    setLoginState(newState)
  }

  if (token === '') {
    return (
      // eslint-disable-next-line react/jsx-no-bind
      <LoginView token={token} changeToken={changeToken} loginState={loginState} changeLoginState={changeLoginState} />
    )
  }
  // eslint-disable-next-line react/jsx-no-bind
  return <MainView token={token} changeToken={changeToken} changeLoginState={changeLoginState} />
}
