/*
Library of functions which interact with the particle api to return/modify data.
 */
// eslint-disable-next-line import/no-import-module-exports
import Product from './Product'

const Particle = require('particle-api-js')

const particle = new Particle()

/**
 * login: attempts an asynchronous login to a user's Particle account.
 * @async
 * @param username the user's username/email.
 * @param password the user's respective password.
 * @returns {Promise} a token in the event of a successful login or null in the
 * event of an unsuccessful login (technically a promise)
 */
async function login(username, password) {
  let token
  try {
    const loginData = await particle.login({ username, password })
    token = loginData.body.access_token
    return token
  } catch (err) {
    console.error('Error in acquiring token: ', err)
    return null
  }
}

/**
 * getDisplayName: Retrieves a user's name or company name based on a Particle
 * access token.
 * @async
 * @param token Particle access token.
 * @returns {Promise<string>} user's name if successful on a personal account,
 * business's name if successful on a business account, error message if
 * unsuccessful.
 */
async function getDisplayName(token) {
  try {
    const response = await particle.getUserInfo({ auth: token })

    if (response.body.account_info.business_account) {
      return response.body.account_info.company_name
    }
    const firstName = response.body.account_info.first_name
    const lastName = response.body.account_info.last_name
    return firstName.concat(' ', lastName)
  } catch (err) {
    console.error('Error in acquiring display name: ', err)
    return 'Fatal error. Please relaunch the accelerator'
  }
}

/**
 * getProducts: retrieves a list of the current product families in a Particle
 * account based on the provided token.
 * @async
 * @param token Particle access token.
 * @returns {Promise} a list of the current products associated with the token
 * user account if successful, null if unsuccessful.
 */
async function getProducts(token) {
  try {
    const response = await particle.listProducts({ auth: token })
    const rawProducts = response.body.products
    const productList = []
    // eslint-disable-next-line no-restricted-syntax
    for (const product of rawProducts) {
      productList.push(new Product(product.name, product.id, product.platform_id))
    }
    return productList
  } catch {
    return null
  }
}

/**
 * getDeviceInfo: makes a GET request to the Particle server to get a device's
 * deviceID and ICCID.
 * @async
 * @param serialNum The current device's serial number.
 * @param token     Particle access token of the account to register to.
 * @returns {Promise} an Object containing the device's deviceID and iccid
 * (fields named respectively) if successful, 'Error' if unsuccessful.
 */
async function getDeviceInfo(serialNum, token) {
  try {
    const deviceData = await particle.lookupSerialNumber({ serialNumber: serialNum, auth: token })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { device_id } = deviceData.body
    const { iccid } = deviceData.body
    const deviceID = device_id
    return { deviceID, iccid }
  } catch (err) {
    console.error('Error in acquiring device information: ', err)
    return 'error'
  }
}

/**
 * activateDeviceSIM: activates the device's SIM and adds it to a user's
 * Particle device family.
 * @async
 * @param iccid   the ICCID of the current device
 * @param country the country to register the SIM in.
 * @param product the product family to add the device to.
 * @param token   a Particle access token for the destination account.
 * @returns {Promise<boolean>} true if successful, false if unsuccessful
 */
async function activateDeviceSIM(iccid, country, product, token) {
  try {
    await particle.activateSIM({
      iccid,
      auth: token,
      country,
      product,
    })
    return true
  } catch (err) {
    console.error('error in sim activation: ', err)
    return false
  }
}

/**
 * changeDeviceName: change's a device's name on the Particle console.
 * @async
 * @param deviceID  the device id of the target Particle device.
 * @param product   the product family ID of the target Particle device.
 * @param newName   the desired name for the target device.
 * @param token     a Particle access token for the account that the target
 *                  device is registered to.
 * @returns {Promise<boolean>} true if the rename is successful, false if
 *                             unsuccessful.
 */
async function changeDeviceName(deviceID, product, newName, token) {
  try {
    await particle.renameDevice({
      deviceId: deviceID,
      name: newName,
      auth: token,
      product,
    })
    return true
  } catch (err) {
    console.error('Error in device rename: ', err)
    return false
  }
}

/**
 * verifyDeviceRegistration: verifies that a device is registered to the desired
 * Particle account and has the correct: deviceID, name, product family, iccid,
 * and serial number.
 * @async
 * @param deviceID      the hypothesised device id of the target device.
 * @param name          the hypothesised name of the target device.
 * @param product       the hypothesised Particle product family of the target
 *                      device.
 * @param iccid         the hypothesised iccid of the target device.
 * @param serialNumber  the hypothesised serial number of the target device.
 * @param token         a Particle access token for the target device's
 *                      registration account.
 * @returns {Promise<boolean>} true if all of the conditions are met, false if
 *                             conditions fail or errors are returned.
 */
async function verifyDeviceRegistration(deviceID, name, product, iccid, serialNumber, token) {
  try {
    const response = await particle.listDevices({
      auth: token,
      product,
      perPage: 100000,
    })
    const filtered = response.body.devices.filter(device => {
      return device.id === deviceID
    })
    if (filtered.length !== 1) {
      return false
    }
    const checkDevice = filtered.pop()
    return !(checkDevice.id !== deviceID || checkDevice.name !== name || checkDevice.iccid !== iccid || checkDevice.serial_number !== serialNumber)
  } catch (err) {
    console.error('Error in device verification: ', err)
    return false
  }
}

async function getDeviceDetails(serialNumber, product, token) {
  try {
    const response = await particle.lookupSerialNumber({ serialNumber, auth: token })
    const deviceID = response.body.device_id
    const info = await particle.getDevice({ deviceId: deviceID, auth: token, product })
    return info.body
  } catch {
    return null
  }
}

module.exports = {
  getDisplayName,
  login,
  getProducts,
  getDeviceInfo,
  activateDeviceSIM,
  changeDeviceName,
  verifyDeviceRegistration,
  getDeviceDetails,
}
