import { createContext } from 'react'

/**
 * loginContext: state hook/object for storing and modifying a Particle access
 * token on the global scope.
 */
const tokenContext = createContext({
  token: null,
  // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
  setToken: newToken => {},
})

export default tokenContext
