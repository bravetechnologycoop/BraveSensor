import { createContext } from 'react'

/**
 * loginContext: state hook/object for storing and modifying a Particle access
 * token on the global scope.
 */
const tokenContext = createContext({
  token: null,
  setToken: () => {},
})

export default tokenContext
