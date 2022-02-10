import { useContext, useEffect, useState } from 'react'
import TokenContext from '../utilities/TokenContext'

const ParticleFunctions = require('../utilities/ParticleFunctions')

const { getDisplayName } = ParticleFunctions

/**
 * WelcomeText: React Component for displaying the user's name or company name.
 */
export default function WelcomeText() {
  const { token } = useContext(TokenContext)

  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    async function fetchUserInfo() {
      const response = await getDisplayName(token)
      const comma = ', '
      setDisplayName(comma.concat(response, '.'))
    }
    fetchUserInfo()
  }, [token])

  return <>Welcome{displayName}</>
}
