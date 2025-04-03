/*
 * teamsHelpers.js
 *
 * Helper functions for Microsoft Teams integration for Brave Server
 */

// In-house dependencies
// const helpers = require('./helpers')

// const TEAMS_CARD_FLOW_URL = helpers.getEnvVar('TEAMS_CARD_FLOW_URL')
// const TEAMS_API_KEY = helpers.getEnvVar('TEAMS_API_KEY')

// --------------------------------------------------------------------------------

/**
 * Higher level function to dynamically create cards based on identifiers
 * @param {string} eventName    Identifier string for card (same as event type details)
 * @param {Object} client       Database client object
 * @param {Object} device       Database device object
 * @returns {Object}            An adaptive card object following Microsoft Teams card format
 */

// createAdaptiveCard

// --------------------------------------------------------------------------------

/**
 * Helper function to assemble adaptive card based on provided parameters
 * @param {string} cardHeader    Optional: Top-most header of the card
 * @param {string} cardTitle     Optional: Title of the card
 * @param {string} cardBody      Required: Body of the card
 * @param {Object} cardInputBox  Optional: Input Box object for the card
 * @param {Object} cardOptions   Optional: Action Set object for the card
 * @returns {Object}             An adaptive card object following Microsoft Teams card format
 */

// assembleAdaptiveCard

/**
 * Converts the survey categories of the client to card options
 * These will be placed in the action set of the teams adaptive card
 * @param {Object} client       Database client object
 * @returns {Object}            Action set card object 
 */

// convertSurveyCategoriesToCardOptions
// will use the createActionSet and return 

/**
 * Creates a Action.Set with Action.Submit options for an adaptive card
 * @param {Array<string>} optionNames  Name of the clickable option
 * @param {boolean} addDataField       Should add data field for selected option
 * @returns {Object}                   JS object to be used into the adaptive card
 */

// createCardActionSet
// returns something like: 
// {
//     "type": "ActionSet",
//     "actions": [
//         {"type": "Action.Submit", "title": "I am on my way!", "data": {"selectedOption": "I am on my way!"}},
//         {"type": "Action.Submit", "title": "abc123", "data": {"selectedOption": "abc123"}},
//     ]
// }
// OR
// returns something like: 
// {
//     "type": "ActionSet",
//     "actions": [
//         {"type": "Action.Submit", "title": "Submit Description"},
//     ]
// }

/**
 * Creates a Input.Text for an adaptive card
 * @param {string} placeholder  Placeholder text for the input box
 * @returns {Object}            JS object to be used into the adaptive card
 */

// createCardInputBox
// returns something like:
// {
//     "type": "Input.Text", 
//     "id": "userInput",
//     "placeholder": "Can you describe what happened?",
//     "isMultiline": true
// }

// --------------------------------------------------------------------------------

/**
 * Post a new adaptive card
 * Sends POST request to MS Teams Power Automate card flow webhook.
 * @param teamsId       TeamId for the client's teams
 * @param channelId     ChannelId for the client's channel
 * @param adaptiveCard  Content of adaptive card to be created (object)
 */

// sendNewTeamsCard()
// Use requestType = 'New'
// Use X-API-KEY as TEAMS_API_KEY in header

/**
 * Update an exisiting adaptive card
 * Sends POST request to MS Teams Power Automate card flow webhook.
 * @param teamsId       TeamId for the client's teams
 * @param channelId     ChannelId for the client's channel
 * @param messageId     MessageId for the card to be updated
 * @param adaptiveCard  Content of adaptive card to be updated (object)
 */

// sendUpdateTeamsCard()
// Use requestType = 'Update'
// Use X-API-KEY in TEAMS_API_KEY in header

// --------------------------------------------------------------------------------
/** 

Individual card construction will look like:
---------------------------------------------

// Creating a inital alert card
const options = ['I am on my way!']
const cardOptions = createActionSet(options, true)
const adaptiveCard = assembleAdaptiveCard("Header", "Body", cardOptions)
return adaptiveCard

or

// Creating an survey card
const cardOptions = convertSurveyCategoriesToCardOptions(client)
const adaptiveCard = assembleAdaptiveCard("Header", "Title", "Body", cardOptions)
return adaptiveCard

or

// Creating a other card with input
const options = ['Submit Description']
const cardOptions = createCardActionSet(options, false)
const placeholderText = 'Can you please describe what happened?' 
const cardInputBox = createCardInputBox(placeholderText)
const adaptiveCard = assembleAdaptiveCard("Header", cardInputBox, cardOptions)
return adaptiveCard

*/

// --------------------------------------------------------------------------------

/**
Use case in code:

// sensorEvents.js - for a new duration alert
if (client.teamsId && client.teamsAlertChannelId) {
    const newAdaptiveCard = createAdaptiveCard('teamsDurationAlert', client, device)
    const result = sendNewTeamsCard(client.teamsId, client.channelId, adaptiveCard)
}

// twilioEvent.js - Suppose phone number responds
if (client.teamsId && client.teamsAlertChannelId) {
    const latestTeamsEvent = await db_new.getLatestTeamsEvent(latestSession)
    const updatedAdaptiveCard = createAdaptiveCard('phoneNumberResponded', client, device)
    const result = sendUpdateTeamsCard(client.teamsId, client.channelId, latestTeamsEvent.messageId, updatedAaptiveCard)
}

// teamsEvents.js - suppose latest team event was stillnessAlert and we got a response back to session
const latestTeamsEvent = await db_new.getLatestTeamsEvent(latestSession)
const updatedAdaptiveCard = createAdaptiveCard('teamStillnessAlertResponded')
const result = updateTeamsCard(client.teamsId, client.channelId, latestTeamsEvent.messageId, updatedAaptiveCard)
const newAdaptiveCard = createAdaptiveCard('teamsStillnessAlertSurvey')
const result = createNewTeamsCard(client.teamsId, client.channelId, newAdaptiveCard)
*/

// --------------------------------------------------------------------------------

/**
 * DB Updates:
 * 
 * clients: (teamsId, teamsAlertChannelId, teamsVitalChannelId)
 * teams_events: (teams_event_id, session_id, event_sent_at, event_type, event_type_details, message_id)
 * sessions: (session_responded_via) ENUM (TWILIO, TEAMS)
 */

// --------------------------------------------------------------------------------