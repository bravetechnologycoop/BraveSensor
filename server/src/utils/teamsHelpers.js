/*
 * teamsHelpers.js
 *
 * Helper functions for Microsoft Teams integration for Brave Server
 */

// Third-party dependencies
const axios = require('axios')

// In-house dependencies
const helpers = require('./helpers')

const TEAMS_CARD_FLOW_URL = helpers.getEnvVar('TEAMS_CARD_FLOW_URL')
const TEAMS_API_KEY = helpers.getEnvVar('TEAMS_API_KEY')

const TEXT_SIZE_LARGE = 'Large'
const TEXT_SIZE_DEFAULT = 'Default'
const TEXT_WEIGHT_BOLDER = 'Bolder'
const TEXT_COLOR_ACCENT = 'Accent'

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
 * @param {string | null} cardHeader    Optional: Top-most header text.
 * @param {string | null} cardTitle     Optional: Title text (often styled differently).
 * @param {string} cardBodyText         Required: Main body text of the card.
 * @param {Object | null} cardInputBox  Optional: Input Box object for the card (from createCardInputBox).
 * @param {Array<Object> | null} cardActions Optional: Array of Action objects (e.g., Action.Submit from createCardActions).
 * @returns {Object | null}             An adaptive card JavaScript object, or a minimal error card object if body text is missing.
 */
function assembleAdaptiveCard(cardHeader, cardTitle, cardBodyText, cardInputBox = null, cardActions = null) {
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

  // Header (Optional)
  if (cardHeader) {
    card.body.push(createCardTextBlock(cardHeader, { size: TEXT_SIZE_LARGE, weight: TEXT_WEIGHT_BOLDER }))
  }

  // Title (Optional)
  if (cardTitle) {
    card.body.push(createCardTextBlock(cardTitle, { size: TEXT_SIZE_DEFAULT, weight: TEXT_WEIGHT_BOLDER, color: TEXT_COLOR_ACCENT }))
  }

  // Body (Required)
  card.body.push(createCardTextBlock(cardBodyText))

  // User Input Box (Optional) - use the passed cardInputBox JS Object
  if (cardInputBox) {
    card.body.push(cardInputBox)
  }

  // Card Actions (Optional) - use the passed cardActions, array of Action.Submit objects
  if (cardActions && Array.isArray(cardActions) && cardActions.length > 0) {
    card.actions = cardActions
  }

  return card
}

// ------------------------------------------------------------------------------------------------
// Higher Level Adaptive Card Creation Helper Functions
// ------------------------------------------------------------------------------------------------

/**
 * Converts the survey categories string of the client to card actions
 * Categories are expected as a comma-separated string.
 * @param {Object} client       Database client object. Requires client.surveyCategories (string).
 * @returns {Object | null}     Action set card object or null if no valid categories found.
 */
function convertSurveyCategoriesToCardActions(client) {
  if (!client || typeof client.surveyCategories !== 'string' || client.surveyCategories.trim() === '') {
    helpers.log('Client survey categories string not found, is not a string, or is empty.')
    return null
  }

  const categories = client.surveyCategories
    .split(',')
    .map(category => category.trim())
    .filter(category => category.length > 0)

  if (categories.length === 0) {
    helpers.log('No valid categories found after splitting and filtering the string.')
    return null
  }

  return createCardActions(categories, true)
}

/**
 * Higher level function to dynamically create cards based on identifiers.
 * @param {string} messageKey       Teams message key: identifier string for card
 * @param {Object} client           Database client object.
 * @param {Object} device           Database device object.
 * @param {Object} [messageData={}] Optional object containing data specific to the messageKey.
 * @returns {Object|null}           An adaptive card object or null if input is invalid
 */
function createAdaptiveCard(messageKey, client, device, eventData = {}) {
  if (!messageKey || !client || !device) {
    helpers.log('createAdaptiveCard: Missing required parameters')
    return null
  }

  let header = null
  let title = null
  let bodyText = null
  let inputBox = null
  let cardActions = null

  helpers.log(eventData)

  switch (messageKey) {
    case 'teamsDurationAlert':
      header = `${device.displayName}`
      title = 'Duration Alert'
      bodyText = `${device.displayName} has been occupied for 20 minutes. Please press the following buttons.`
      inputBox = createCardInputBox('Can you describe what happened?')
      cardActions = convertSurveyCategoriesToCardActions(client)
      break

    default:
      helpers.log(`Unsupported messageKey for createAdaptiveCard: ${messageKey}.`)
      return null
  }

  return assembleAdaptiveCard(header, title, bodyText, inputBox, cardActions)
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
 * Post a new adaptive card to Teams via Power Automate.
 * Sends POST request to MS Teams Power Automate card flow webhook.
 * @param {string} teamsId          TeamId for the client's teams.
 * @param {string} channelId        ChannelId for the client's channel.
 * @param {Object} adaptiveCard     Content of adaptive card to be created (object).
 * @returns {Promise<Object|null>}  The response object containing teamsId, channelId, messageId or null if failure
 */
async function sendNewTeamsCard(teamsId, channelId, adaptiveCard) {
  if (!teamsId || !channelId || !adaptiveCard) {
    helpers.logError('sendNewTeamsCard missing required parameters.')
    return null
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
  const responseBody = responseData && responseData.body

  if (responseBody && responseBody.messageId && responseBody.teamsId && responseBody.channelId) {
    return {
      teamsId: responseBody.teamsId,
      channelId: responseBody.channelId,
      messageId: responseBody.messageId,
    }
  }

  helpers.logError('New Teams card request succeeded (200 OK) but response body structure is unexpected or missing required IDs.')
  helpers.log('Received Response Data:', JSON.stringify(responseData))
  return null
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
  const responseBody = responseData && responseData.body

  if (responseBody && responseBody.messageId && responseBody.teamsId && responseBody.channelId) {
    return {
      teamsId: responseBody.teamsId,
      channelId: responseBody.channelId,
      messageId: responseBody.messageId,
    }
  }

  helpers.logError('Update Teams card request succeeded (200 OK) but response body structure is unexpected or missing required IDs.')
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
