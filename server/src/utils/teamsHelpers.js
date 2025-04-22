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

const INPUT_ID_USERINPUT = 'userInput'

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
 * @returns {Array<Object> | null}     Array of Action.Submit object, or null if input is invalid.
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
function createCardInputBox(placeholder) {
  if (!placeholder) {
    helpers.log('createCardInputBox called without placeholder text.')
  }
  return {
    type: 'Input.Text',
    id: INPUT_ID_USERINPUT, // Use the consistent ID
    placeholder: placeholder || 'Can you please describe what happened?',
    isMultiline: true,
  }
}

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

  // determine the style based on card type
  const containerStyle = cardType === 'New' ? 'attention' : 'emphasis'

  // create the card with content in a styled container
  const card = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      {
        type: 'Container',
        style: containerStyle,
        items: [],
      },
    ],
    actions: [],
  }

  const contentContainer = card.body[0]
  const items = contentContainer.items

  if (cardHeader) {
    items.push(cardHeader)
  }
  if (cardTitle) {
    items.push(cardTitle)
  }
  if (cardBodyText) {
    items.push(cardBodyText)
  }
  if (cardInputBox) {
    items.push(cardInputBox)
  }

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

  if (messageKey) {
    cardHeader = `${deviceName}`
  } else {
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
    // Duration Alert Types
    case 'teamsDurationAlert':
      cardTitle = 'Duration Alert'
      break
    case 'teamsDurationAlertSurvey':
    case 'teamsDurationAlertSurveyDoorOpened':
      cardTitle = 'Duration Alert Survey'
      break
    case 'teamsDurationAlertSurveyOtherFollowup':
      cardTitle = 'Duration Alert Follow-up'
      break
    case 'teamsDurationAlertSurveyOccupantOkayFollowup':
      cardTitle = 'Occupant Okay Follow-up'
      break
    case 'teamsDurationAlertSurveyOccupantOkayEnd':
      cardTitle = 'Thank You'
      break

    // Stillness Alert Types
    case 'teamsStillnessAlert':
      cardTitle = 'Stillness Alert'
      break
    case 'teamsStillnessAlertFirstReminder':
      cardTitle = 'Stillness Alert - 1st Reminder'
      break
    case 'teamsStillnessAlertSecondReminder':
      cardTitle = 'Stillness Alert - 2nd Reminder'
      break
    case 'teamsStillnessAlertThirdReminder':
      cardTitle = 'Stillness Alert - Final Reminder'
      break
    case 'teamsStillnessAlertFollowup':
      cardTitle = 'Stillness Alert'
      break
    case 'teamsStillnessAlertSurvey':
    case 'teamsStillnessAlertSurveyDoorOpened':
      cardTitle = 'Stillness Alert Survey'
      break
    case 'teamsStillnessAlertSurveyOtherFollowup':
      cardTitle = 'Stillness Alert Follow-up'
      break
    case 'teamsStillnessAlertSurveyOccupantOkayFollowup':
      cardTitle = 'Occupant Okay Follow-up'
      break
    case 'teamsStillnessAlertSurveyOccupantOkayEnd':
      cardTitle = 'Thank You'
      break

    // Other Messages
    case 'teamsThankYou':
      cardTitle = 'Thank You'
      break
    case 'teamsReportIssue':
      cardTitle = 'Help Information'
      break
    case 'teamsRespondedViaTwilio':
      cardTitle = 'Alert Handled via SMS'
      break

    // Vital Messages
    case 'teamsDoorLowBattery':
      cardTitle = 'Low Battery Alert'
      break
    case 'teamsDeviceDisconnectedInitial':
      cardTitle = 'Device Disconnected'
      break
    case 'teamsDeviceDisconnectedReminder':
      cardTitle = 'Device Still Disconnected'
      break
    case 'teamsDoorDisconnectedInitial':
      cardTitle = 'Door Sensor Disconnected'
      break
    case 'teamsDoorDisconnectedReminder':
      cardTitle = 'Door Sensor Still Disconnected'
      break
    case 'teamsDeviceReconnected':
      cardTitle = 'Device Reconnected'
      break
    case 'teamsDoorReconnected':
      cardTitle = 'Door Sensor Reconnected'
      break
    case 'teamsDoorTampered':
      cardTitle = 'Door Sensor Tampered'
      break
    case 'teamsDoorInactivity':
      cardTitle = 'Door Sensor Inactivity'
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
    // Duration Alert Types
    case 'teamsDurationAlert':
      cardBody = `${deviceName} has been occupied for ${messageData.occupancyDuration} minutes. Please press the button below if you are on your way.`
      break
    case 'teamsDurationAlertSurvey':
      cardBody = `Could you please let us know the outcome?`
      break
    case 'teamsDurationAlertSurveyDoorOpened':
      cardBody = `We see the door has been opened. Could you please let us know the outcome?`
      break
    case 'teamsDurationAlertSurveyOtherFollowup':
      cardBody = `Can you please describe what happened?`
      break
    case 'teamsDurationAlertSurveyOccupantOkayFollowup':
      cardBody = `We will continue to monitor this location. Select the button below to stop monitoring.`
      break
    case 'teamsDurationAlertSurveyOccupantOkayEnd':
      cardBody = `You will no longer receive alerts until the next entry. Thank you!`
      break

    // Stillness Alert Types
    case 'teamsStillnessAlert':
      cardBody = `${deviceName} needs a SAFETY CHECK. Please press the button below if you are on your way.`
      break
    case 'teamsStillnessAlertFirstReminder':
    case 'teamsStillnessAlertSecondReminder':
    case 'teamsStillnessAlertThirdReminder':
      cardBody = `${deviceName} needs a SAFETY CHECK. Please press the button below if you are on your way.`
      break
    case 'teamsStillnessAlertFallback':
      cardBody = `No response to stillness alerts for ${deviceName}. There will be one final alert.`
      break
    case 'teamsStillnessAlertFollowup':
      cardBody = `Thanks, we'll follow up in ${messageData.stillnessAlertFollowupTimer} minutes.`
      break
    case 'teamsStillnessAlertSurvey':
      cardBody = `Could you please let us know the outcome?`
      break
    case 'teamsStillnessAlertSurveyDoorOpened':
      cardBody = `We see the door has been opened.\nCould you please let us know the outcome?`
      break
    case 'teamsStillnessAlertSurveyOtherFollowup':
      cardBody = `Can you please describe what happened?`
      break
    case 'teamsStillnessAlertSurveyOccupantOkayFollowup':
      cardBody = `We will continue to monitor this location. Select the button below to stop monitoring.`
      break
    case 'teamsStillnessAlertSurveyOccupantOkayEnd':
      cardBody = `You will no longer receive alerts until the next entry. Thank you!`
      break

    // Response Messages
    case 'teamsNoResponseExpected':
      cardBody = `Invalid response, no response expected.`
      break
    case 'teamsInvalidResponseTryAgain':
      cardBody = `Invalid response, please try again.`
      break
    case 'teamsNonAttendingResponderConfirmation':
      cardBody = `Another responder is attending to this alert.`
      break
    case 'teamsRespondedViaTwilio':
      cardBody = `Another responder is attending to this alert via Twilio.`
      break
    case 'teamsThankYou':
      cardBody = `Thank you, monitoring will be paused until the next entry.`
      break
    case 'teamsReportIssue':
      cardBody = `You can reach us at:\nPhone: +18338332100\nEmail: clientsupport@brave.coop\nThank you!`
      break

    // Device Status Messages
    case 'teamsDoorLowBattery':
      cardBody = `The battery for the ${deviceName} door sensor is low, and needs replacing.\nTo watch a video showing how to replace the battery, go to https://youtu.be/-mfk4-qQc4w.`
      break
    case 'teamsDoorTampered':
      cardBody = `The door contact at ${deviceName} is not fully attached to the door. For a replacement or any questions, email clientsupport@brave.coop.`
      break
    case 'teamsDoorInactivity':
      cardBody = `The door contact at ${deviceName} has not detected any activity in a long time. Please make sure that both parts of the door contact are fully attached to the door. If you require a replacement or have any questions, email clientsupport@brave.coop.`
      break
    case 'teamsDeviceDisconnectedInitial':
      cardBody = `The Brave Sensor at ${deviceName} (${clientDisplayName}) has disconnected. Please email clientsupport@brave.coop.`
      break
    case 'teamsDeviceDisconnectedReminder':
      cardBody = `The Brave Sensor at ${deviceName} (${clientDisplayName}) is still disconnected. Please email clientsupport@brave.coop.`
      break
    case 'teamsDoorDisconnectedInitial':
      cardBody = `The door contact for ${deviceName} (${clientDisplayName}) has disconnected. Please reattach the door contact or replace the battery if necessary. Email clientsupport@brave.coop if a replacement is required.`
      break
    case 'teamsDoorDisconnectedReminder':
      cardBody = `The door contact for ${deviceName} (${clientDisplayName}) is still disconnected. Please reattach the door contact or replace the battery if necessary. Email clientsupport@brave.coop if a replacement is required.`
      break
    case 'teamsDeviceReconnected':
      cardBody = `The Brave Sensor at ${deviceName} (${clientDisplayName}) has been reconnected.`
      break
    case 'teamsDoorReconnected':
      cardBody = `The door contact at ${deviceName} (${clientDisplayName}) has been reconnected.`
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
    case 'teamsDurationAlertSurveyOtherFollowup':
    case 'teamsStillnessAlertSurveyOtherFollowup':
      return createCardInputBox('Enter text here and click submit when done. This can be empty.')
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
  const submitInput = ['Submit']
  const stopMonitoring = ['Stop Monitoring']

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
    case 'teamsDurationAlertSurveyOccupantOkayFollowup':
    case 'teamsStillnessAlertSurveyOccupantOkayFollowup':
      cardActionsArray = createCardActions(stopMonitoring, true)
      break
    case 'teamsDurationAlertSurveyOtherFollowup':
    case 'teamsStillnessAlertSurveyOtherFollowup':
      cardActionsArray = createCardActions(submitInput, false) // input
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
    const previousTeamsEvent = await db_new.getLatestRespondableTeamsEvent(session.sessionId)
    if (!previousTeamsEvent) {
      return
    }

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
