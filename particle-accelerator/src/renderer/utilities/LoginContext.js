import { createContext } from 'react'

/**
 * loginContext: state hook/object for storing and modifying the state of login
 * on the global scope.
 * */
const loginContext = createContext({
  loginState: 'false',
  setLoginState: () => {},
})

export default loginContext
