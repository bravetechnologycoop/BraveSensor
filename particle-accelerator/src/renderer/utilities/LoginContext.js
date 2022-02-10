import { createContext } from 'react'

/**
 * loginContext: state hook/object for storing and modifying the state of login
 * on the global scope.
 * */
const loginContext = createContext({
  loginState: 'false',
  // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
  setLoginState: newLoginState => {},
})

export default loginContext
