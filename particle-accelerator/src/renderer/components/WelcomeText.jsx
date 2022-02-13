import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

const ParticleFunctions = require('../utilities/ParticleFunctions')

const { getDisplayName } = ParticleFunctions

/**
 * WelcomeText: React Component for displaying the user's name or company name.
 */
function WelcomeText(props) {
  const { token } = props

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

WelcomeText.propTypes = {
  token: PropTypes.string,
}

WelcomeText.defaultProps = {
  token: '',
}

export default WelcomeText
