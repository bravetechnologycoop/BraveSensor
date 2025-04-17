/*
 * teamsHelpers.js
 *
 * Helper functions for Microsoft Teams integration for Brave Server
 */

// Third-party dependencies
const axios = require('axios')

// In-house dependencies
const helpers = require('./helpers')
const db_new = require('../db/db_new')

const TEAMS_CARD_FLOW_URL = helpers.getEnvVar('TEAMS_CARD_FLOW_URL')
const TEAMS_API_KEY = helpers.getEnvVar('TEAMS_API_KEY')

const TEXT_SIZE_EXTRA_LARGE = 'ExtraLarge'
const TEXT_SIZE_LARGE = 'Large'
const TEXT_SIZE_DEFAULT = 'Default'
const TEXT_WEIGHT_BOLDER = 'Bolder'
const TEXT_COLOR_ACCENT = 'Accent'
const TEXT_COLOR_ATTENTION = 'Attention'

// const INPUT_ID_USERINPUT = 'userInput'

// ------------------------------------------------------------------------------------------------
// Adaptive Card Creation Helper Functions
// ------------------------------------------------------------------------------------------------

/**
 * Creates a basic TextBlock element for the adaptive card.
 * @param {string} text         The text content.
 * @param {Object} [options]    Optional styling { size, weight, color, wrap }.
 * @returns {Object}            TextBlock adaptive card element.
 */
function createCardTextBlock(text, { size = TEXT_SIZE_DEFAULT, weight = 'Default', color = 'Default', wrap = true } = {}) {
  return {
    type: 'TextBlock',
    text,
    size,
    weight,
    color,
    wrap,
  }
}

/**
 * Creates Action.Submit options for an adaptive card
 * @param {Array<string>} optionNames  Array of options.
 * @param {boolean} addDataField       If true, adds data: {selectedOption: title} to each action.
 * @returns {Array<Object> | null}       Array of Action.Submit object, or null if input is invalid.
 */
function createCardActions(optionNames, addDataField) {
  if (!Array.isArray(optionNames) || optionNames.length === 0) {
    helpers.log('createCardActions called with invalid optionNames.')
    return []
  }

  const actions = optionNames.map(name => {
    const action = {
      type: 'Action.Submit',
      title: name,
    }

    // These fields are responsible of returning data when the button is clicked.
    // Returned data (selectedOption) will be the same as the name of the button
    if (addDataField) {
      action.data = {
        selectedOption: name,
      }
    }

    return action
  })

  return actions
}

/**
 * Creates a Input.Text for an adaptive card using a consistent ID.
 * @param {string} placeholder  Placeholder text for the input box.
 * @returns {Object}            JS object for the Input.Text element.
 */
// function createCardInputBox(placeholder) {
//   if (!placeholder) {
//     helpers.log('createCardInputBox called without placeholder text.')
//   }
//   return {
//     type: 'Input.Text',
//     id: INPUT_ID_USERINPUT, // Use the consistent ID
//     placeholder: placeholder || 'Can you please describe what happened?',
//     isMultiline: true,
//   }
// }

/**
 * Helper function to assemble an adaptive card object based on provided parameters.
 * @param {string} cardType             Card type ('New' or 'Update')
 * @param {Object} cardHeader           Text block object for the header
 * @param {Object} cardTitle            Text block object for the title
 * @param {Object} cardBodyText         Text block object for the body
 * @param {Object} cardInputBox         Input box object for the title
 * @param {Array<Object>} cardActions   Array of action objects for the actions
 * @returns {Object}                    An adaptive card JS object or a minimal error card object if body text is missing.
 */
function assembleAdaptiveCard(cardType, cardHeader, cardTitle, cardBodyText, cardInputBox, cardActions) {
  if (!cardBodyText) {
    helpers.log("assembleAdaptiveCard requires 'cardBodyText'. Returning minimal error card object.")
    return {
      type: 'AdaptiveCard',
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      version: '1.5',
      body: [createCardTextBlock('Error: Card could not be generated.')],
    }
  }

  const card = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [],
    actions: [],
  }

  let targetBody = null

  // Add red tinted bg (attention) for cardType if 'New'
  // otherwise, use a light grey bg (emphasis) for other request like 'Update'
  if (cardType === 'New') {
    const container = {
      type: 'Container',
      style: 'attention',
      items: [],
    }
    card.body.push(container)
    targetBody = container.items
  } else {
    const container = {
      type: 'Container',
      style: 'emphasis',
      items: [],
    }
    card.body.push(container)
    targetBody = container.items
  }

  // Body
  if (cardHeader) {
    targetBody.push(cardHeader)
  }
  if (cardTitle) {
    targetBody.push(cardTitle)
  }
  if (cardBodyText) {
    targetBody.push(cardBodyText)
  }
  if (cardInputBox) {
    targetBody.push(cardInputBox)
  }

  // Actions
  if (cardActions && Array.isArray(cardActions) && cardActions.length > 0) {
    card.actions = cardActions
  }

  return card
}

// ------------------------------------------------------------------------------------------------
// Higher Level Adaptive Card Creation Helper Functions
// ------------------------------------------------------------------------------------------------

/**
 * Gets the header text for a card based on the message key and device.
 * @param {string} messageKey   Teams message key
 * @param {Object} device       Database device object.
 * @returns {Object | null}     Adaptive card text block object for the header
 */
function getCardHeader(messageKey, device) {
  if (!device || !device.displayName) {
    helpers.log(`getCardHeader: Missing required parameters`)
    return null
  }

  const deviceName = device.displayName

  let cardHeader = null

  switch (messageKey) {
    case 'teamsDurationAlert':
    case 'teamsStillnessAlert':
    case 'teamsStillnessAlertFirstReminder':
    case 'teamsStillnessAlertSecondReminder':
    case 'teamsStillnessAlertThirdReminder':
    case 'teamsDurationAlertSurveyDoorOpened':
    case 'teamsStillnessAlertSurveyDoorOpened':
    case 'teamsDurationAlertSurvey':
    case 'teamsDoorLowBattery':
    case 'teamsDeviceDisconnectedInitial':
    case 'teamsDeviceDisconnectedReminder':
    case 'teamsDoorDisconnectedInitial':
    case 'teamsDoorDisconnectedReminder':
    case 'teamsDeviceReconnected':
    case 'teamsDoorReconnected':
    case 'teamsDoorTampered':
    case 'teamsDoorInactivity':
      cardHeader = `${deviceName}`
      break
    default:
      return null
  }

  return createCardTextBlock(cardHeader, {
    size: TEXT_SIZE_EXTRA_LARGE,
    weight: TEXT_WEIGHT_BOLDER,
  })
}

/**
 * Gets the title text for a card based on the message key.
 * @param {string} messageKey   Teams message key
 * @param {string} cardType     Card Type ('New' or 'Update') to determine card title color
 * @returns {Object | null}     Adaptive card text block object for the title
 */
function getCardTitle(messageKey, cardType) {
  let cardTitle = null

  switch (messageKey) {
    case 'teamsDurationAlert':
      cardTitle = 'Duration Alert'
      break
    case 'teamsStillnessAlert':
      cardTitle = 'Stillness Alert'
      break
    case 'teamsStillnessAlertFirstReminder':
      cardTitle = 'First Stillness Reminder'
      break
    case 'teamsStillnessAlertSecondReminder':
      cardTitle = 'Second Stillness Reminder'
      break
    case 'teamsStillnessAlertThirdReminder':
      cardTitle = 'Final Stillness Reminder'
      break
    case 'teamsDurationAlertSurvey':
    case 'teamsDurationAlertSurveyDoorOpened':
      cardTitle = 'Duration Alert Survey'
      break
    case 'teamsStillnessAlertSurveyDoorOpened':
      cardTitle = 'Stillness Alert Survey'
      break
    default:
      return null
  }

  return createCardTextBlock(cardTitle, {
    size: TEXT_SIZE_LARGE,
    weight: TEXT_WEIGHT_BOLDER,
    color: cardType === 'New' ? TEXT_COLOR_ATTENTION : TEXT_COLOR_ACCENT,
  })
}

/**
 * Gets the default body text for a new card based on the message key.
 * @param {string} messageKey       Teams message key
 * @param {Object} device           Database device object.
 * @param {Object} client           Database client object (needed for some messages).
 * @param {Object} [messageData={}] Optional data relevant to the message (e.g., duration).
 * @returns {Object}                Adaptive card text block object for the body
 */
function getCardBody(messageKey, device, client, messageData = {}) {
  if (!client || !device || !device.displayName) {
    helpers.log(`getCardBody: Missing required parameters`)
    return null
  }

  const deviceName = device.displayName
  const clientDisplayName = client.displayName

  let cardBody

  switch (messageKey) {
    case 'teamsDurationAlert':
      cardBody = `${deviceName} has been occupied for ${messageData.occupancyDuration} minutes. Please press the button below if you are on your way.`
      break
    case 'teamsStillnessAlert':
      cardBody = `${deviceName} needs a SAFETY CHECK. Please press the button below if you are on your way.`
      break
    case 'teamsStillnessAlertFirstReminder':
      cardBody = `1st REMINDER\n${deviceName} needs a SAFETY CHECK. Please press the button below if you are on your way.`
      break
    case 'teamsStillnessAlertSecondReminder':
      cardBody = `2nd REMINDER\n${deviceName} needs a SAFETY CHECK. Please press the button below if you are on your way.`
      break
    case 'teamsStillnessAlertThirdReminder':
      cardBody = `FINAL REMINDER\n${deviceName} needs a SAFETY CHECK. Please press the button below if you are on your way.`
      break
    case 'teamsDurationAlertSurvey':
    case 'teamsStillnessAlertSurvey':
      cardBody = `Could you please let us know the outcome?`
      break
    case 'teamsDurationAlertSurveyDoorOpened':
    case 'teamsStillnessAlertSurveyDoorOpened':
      cardBody = `We see the door has been opened.\nCould you please let us know the outcome?`
      break
    case 'sessionAlreadyCompleted':
      cardBody = `This alert has already been responded to. Thank you for your response.`
      break
    case 'teamsDoorLowBattery':
      cardBody = `The battery for the \n${deviceName} door sensor is low, and needs replacing.\nTo watch a video showing how to replace the battery, go to https://youtu.be/-mfk4-qQc4w.`
      break
    case 'teamsDeviceDisconnectedInitial':
      cardBody = `The Brave Sensor at \n${deviceName} (\n${clientDisplayName} ) has disconnected. Please email clientsupport@brave.coop.`
      break
    case 'teamsDeviceDisconnectedReminder':
      cardBody = `${deviceName} is still disconnected from the network. Please ensure the device is properly connected.`
      break
    case 'teamsDoorDisconnectedInitial':
      cardBody = `The door contact for \n${deviceName} (\n${clientDisplayName} ) has disconnected. Please reattach the door contact or replace the battery if necessary. Email clientsupport@brave.coop if a replacement is required.`
      break
    case 'teamsDoorDisconnectedReminder':
      cardBody = `The door contact for \n${deviceName} (\n${clientDisplayName} ) is still disconnected. Please reattach the door contact or replace the battery if necessary. Email clientsupport@brave.coop if a replacement is required.`
      break
    case 'teamsDeviceReconnected':
      cardBody = `The Brave Sensor at \n${deviceName} (\n${clientDisplayName} ) has been reconnected.`
      break
    case 'teamsDoorReconnected':
      cardBody = `The door contact at \n${deviceName} (\n${clientDisplayName} ) has been reconnected.`
      break
    case 'teamsDoorTampered':
      cardBody = `The door contact at \n${deviceName} is not fully attached to the door. For a replacement or any questions, email clientsupport@brave.coop.`
      break
    case 'teamsDoorInactivity':
      cardBody = `The door contact at \n${deviceName} has not detected any activity in a long time please make sure that both parts of the door contact are fully attached to the door. If you require a replacement or have any questions, email clientsupport@brave.coop.`
      break
    default:
      cardBody = 'Default Card Body'
  }

  return createCardTextBlock(cardBody)
}

/**
 * Gets the InputBox object for a new card based on the message key.
 * @param {string} messageKey   Teams message key (e.g., 'teamsDurationAlert').
 * @returns {Object | null}     Adaptive card input box object for the body
 */
function getCardInput(messageKey) {
  switch (messageKey) {
    default:
      return null
  }
}

/**
 * Gets the array of card Actions for a new card based on the message key.
 * @param {string} messageKey   Teams message key (e.g., 'teamsDurationAlert').
 * @param {Object} client       Database client object (needed for survey categories).
 * @returns {Array<Object> | null} An array of Action objects or null/empty array.
 */
function getCardActions(messageKey, client) {
  if (!client || !client.surveyCategories) {
    helpers.log(`getCardBody: Missing required parameters`)
    return null
  }

  const iAmOnMyWay = ['I am on my way!']

  let cardActionsArray

  switch (messageKey) {
    case 'teamsDurationAlert':
    case 'teamsStillnessAlert':
    case 'teamsStillnessAlertFirstReminder':
    case 'teamsStillnessAlertSecondReminder':
    case 'teamsStillnessAlertThirdReminder':
      cardActionsArray = createCardActions(iAmOnMyWay, true)
      break
    case 'teamsDurationAlertSurvey':
    case 'teamsStillnessAlertSurvey':
    case 'teamsDurationAlertSurveyDoorOpened':
    case 'teamsStillnessAlertSurveyDoorOpened':
      cardActionsArray = createCardActions(client.surveyCategories, true)
      break
    default:
      return null
  }

  return cardActionsArray
}

/**
 * Higher level function to dynamically create cards based on identifiers.
 * @param {string} messageKey       Teams message key: identifier string for card
 * @param {string} cardType         Card Type: 'New', 'Update'
 * @param {Object} client           Database client object.
 * @param {Object} device           Database device object.
 * @param {Object} [messageData={}] Optional object containing data specific to the messageKey.
 * @returns {Object|null}           An adaptive card object or null if input is invalid
 */
function createAdaptiveCard(messageKey, cardType, client, device, messageData = {}) {
  if (!messageKey || !cardType || !client || !device) {
    helpers.log('createAdaptiveCard: Missing required parameters')
    return null
  }

  let header = null
  let title = null
  let bodyText = null
  let inputBox = null
  let cardActions = null

  // header and title
  header = getCardHeader(messageKey, device)
  title = getCardTitle(messageKey, cardType)

  // If we have an update request and the addition messageData specifies the body text, use that
  // Useful for update request like expire previous card as they map to header/title using key but different body text
  if (cardType === 'Update' && messageData && messageData.bodyText) {
    bodyText = createCardTextBlock(messageData.bodyText)
  } else if (messageData) {
    bodyText = getCardBody(messageKey, device, client, messageData)
  } else {
    bodyText = getCardBody(messageKey, device, client)
  }

  // other card items
  if (cardType === 'Update' && messageData && messageData.bodyText) {
    inputBox = null
    cardActions = null
  } else {
    inputBox = getCardInput(messageKey)
    cardActions = getCardActions(messageKey, client)
  }

  return assembleAdaptiveCard(cardType, header, title, bodyText, inputBox, cardActions)
}

// ------------------------------------------------------------------------------------------------

/**
 * Helper function that sends the actual HTTP request to the Power Automate flow.
 * @param {Object} payload          The request body to send.
 * @returns {Promise<Object|null>}  The response data from the flow or null on error.
 */
async function sendTeamsRequest(payload) {
  if (!TEAMS_CARD_FLOW_URL || !TEAMS_API_KEY) {
    helpers.logError('Teams flow URL or API Key not configured. Cannot send request.')
    return null
  }

  try {
    const response = await axios.post(TEAMS_CARD_FLOW_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TEAMS_API_KEY,
      },
    })

    return response
  } catch (error) {
    if (error.response) {
      helpers.logError(`Teams API request failed. Status: ${error.response.status}`)
      return error.response
    }
    if (error.request) {
      helpers.logError('Error sending request to Teams flow: No response received', error.message)
    } else {
      helpers.logError('Error configuring request to Teams flow:', error.message)
    }
    return null
  }
}

/**
 * Update an existing adaptive card in Teams via Power Automate.
 * Sends POST request to MS Teams Power Automate card flow webhook.
 * @param {string} teamsId      TeamId for the client's teams.
 * @param {string} channelId    ChannelId for the client's channel.
 * @param {string} messageId    MessageId for the card to be updated.
 * @param {Object} adaptiveCard Content of adaptive card to be updated (object).
 * @returns {Promise<Object|null>}  The response object containing teamsId, channelId, messageId or null if failure
 */
async function sendUpdateTeamsCard(teamsId, channelId, messageId, adaptiveCard) {
  if (!teamsId || !channelId || !messageId || !adaptiveCard) {
    helpers.logError('sendUpdateTeamsCard missing required parameters.')
    return null
  }

  const payload = {
    teamsId,
    channelId,
    messageId,
    adaptiveCard,
    requestType: 'Update',
  }

  const response = await sendTeamsRequest(payload)

  if (!response || response.status !== 200) {
    if (response && response.data) {
      helpers.logError('Failed to update Teams card. Error response:', JSON.stringify(response.data))
    }
    return null
  }

  const responseData = response.data
  if (responseData && responseData.messageId && responseData.teamsId && responseData.channelId) {
    return {
      teamsId: responseData.teamsId,
      channelId: responseData.channelId,
      messageId: responseData.messageId,
    }
  }

  helpers.logError('Update Teams card request succeeded (200 OK) but response body structure is unexpected or missing required IDs.')
  helpers.log('Received Response Data:', JSON.stringify(responseData))
  return null
}

/**
 * Updates a previous Teams card to an "expired" state.
 */
async function expirePreviousTeamsCard(teamsId, channelId, session) {
  try {
    const previousTeamsEvent = await db_new.getLatestTeamsEvent(session.sessionId)
    if (!previousTeamsEvent) {
      helpers.log('No event found to expire')
      return
    }

    helpers.log('Expiring previous event')
    const client = await db_new.getClientWithDeviceId(session.deviceId)
    const device = await db_new.getDeviceWithDeviceId(session.deviceId)
    if (!client || !device) {
      helpers.log('No client/device found for session')
      return
    }

    // create a updated adaptive card
    const messageData = { bodyText: 'This alert has expired. Please respond to the latest alert for this washroom.' }
    const cardType = 'Update'
    const updatedAdaptiveCard = await createAdaptiveCard(previousTeamsEvent.eventTypeDetails, cardType, client, device, messageData)
    if (!updatedAdaptiveCard) {
      throw new Error(`Failed to create updated adaptive card for teams event`)
    }

    // update the previous card
    const response = await sendUpdateTeamsCard(teamsId, channelId, previousTeamsEvent.messageId, updatedAdaptiveCard)
    if (!response || !response.messageId) {
      throw new Error(`Failed to update Teams card or invalid response received for session ${session.sessionId}`)
    }

    helpers.log('Expired previous event')
  } catch (error) {
    throw new Error(`expirePreviousTeamsCard: ${error.message}`)
  }
}

/**
 * Post a new adaptive card to Teams via Power Automate.
 * Sends POST request to MS Teams Power Automate card flow webhook.
 * @param {string} teamsId          TeamId for the client's teams.
 * @param {string} channelId        ChannelId for the client's channel.
 * @param {Object} adaptiveCard     Content of adaptive card to be created (object).
 * @param {Object} session          Session to which the alert belongs to (Optional).
 * @returns {Promise<Object|null>}  The response object containing teamsId, channelId, messageId or null if failure
 */
async function sendNewTeamsCard(teamsId, channelId, adaptiveCard, session = {}) {
  if (!teamsId || !channelId || !adaptiveCard) {
    helpers.logError('sendNewTeamsCard missing required parameters.')
    return null
  }

  if (session && Object.keys(session).length > 0) {
    await expirePreviousTeamsCard(teamsId, channelId, session)
  }

  const payload = {
    teamsId,
    channelId,
    adaptiveCard,
    requestType: 'New',
  }

  const response = await sendTeamsRequest(payload)

  if (!response || response.status !== 200) {
    if (response && response.data) {
      helpers.logError('Failed to create new Teams card. Error response:', JSON.stringify(response.data))
    }
    return null
  }

  const responseData = response.data
  if (responseData && responseData.messageId && responseData.teamsId && responseData.channelId) {
    return {
      teamsId: responseData.teamsId,
      channelId: responseData.channelId,
      messageId: responseData.messageId,
    }
  }

  helpers.logError('New Teams card request succeeded (200 OK) but response body structure is unexpected or missing required IDs.')
  helpers.log('Received Response Data:', JSON.stringify(responseData))
  return null
}

// ------------------------------------------------------------------------------------------------
// Exports
// ------------------------------------------------------------------------------------------------

module.exports = {
  createAdaptiveCard,
  sendNewTeamsCard,
  sendUpdateTeamsCard,
}

// ------------------------------------------------------------------------------------------------
