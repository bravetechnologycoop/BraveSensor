import Form from 'react-bootstrap/Form'
import { useContext, useState } from 'react'
import Button from 'react-bootstrap/Button'
import TokenContext from '../utilities/TokenContext'
import LoginContext from '../utilities/LoginContext'

const ParticleFunctions = require('../utilities/ParticleFunctions')

const { login } = ParticleFunctions

/**
 * LoginForm:
 * A React component which allows a user to log into an account using their
 * username and email and acquires a token if the login is successful.
 * @modifies the global token variable and the global loginState variable.
 */
function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { setToken } = useContext(TokenContext)
  function changeToken(newToken) {
    setToken(newToken)
  }

  const { setLoginState } = useContext(LoginContext)
  function changeLoginState(newState) {
    setLoginState(newState)
  }

  async function handleSubmit(evt) {
    changeLoginState('waiting')
    evt.preventDefault()
    const token = await login(email, password)

    if (token !== null) {
      setEmail('')
      setPassword('')
      changeLoginState('true')
      changeToken(token)
    } else {
      changeLoginState('passwordincorrect')
    }
  }

  return (
    // eslint-disable-next-line react/jsx-no-bind
    <Form onSubmit={handleSubmit}>
      <Form.Group className="mb-3" controlId="formBasicEmail">
        <Form.Label>Email address</Form.Label>
        <Form.Control type="email" placeholder="Enter email" value={email} onChange={x => setEmail(x.target.value)} />
      </Form.Group>

      <Form.Group className="mb-3" controlId="formBasicPassword">
        <Form.Label>Password</Form.Label>
        <Form.Control type="password" placeholder="Password" value={password} onChange={x => setPassword(x.target.value)} />
      </Form.Group>
      <Button variant="primary" type="submit">
        Submit
      </Button>
    </Form>
  )
}

export default LoginForm
