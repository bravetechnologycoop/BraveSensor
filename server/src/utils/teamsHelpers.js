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
 * Converts the survey categories of the client to card options
 * These will be placed in the action set of the teams adaptive card
 * @param {Object} client       Database client object
 * @returns {Object}            Action set card object 
 */

// convertSurveyCategoriesToCardOptions
// will use the createActionSet and return 

// --------------------------------------------------------------------------------

/**
 * Creates a Action.Set with Action.Submit options for an adaptive card
 * @param {Array<string>} optionNames  Name of the clickable option
 * @param {boolean} addDataField       Should add data field for selected option
 * @returns {Object}                   Action set card object
 */

// createActionSet
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
 * @returns {Object}            Adaptive card object 
 */

// createInputBox
// returns something like:
// {
//     "type": "Input.Text", 
//     "id": "userInput",
//     "placeholder": "Can you describe what happened?",
//     "isMultiline": true
// }

/**
 * Helper function to create adaptive card based on provided parameters
 * @param {string} cardHeader    Optional: Top-most header of the card
 * @param {string} cardTitle     Optional: Title of the card
 * @param {string} cardBody      Required: Body of the card
 * @param {Object} cardInputBox  Optional: Input Box object for the card
 * @param {Object} cardOptions   Optional: Action Set object for the card
 * @returns {Object} An adaptive card object following Microsoft Teams card format
 */

// createAdaptiveCard

// --------------------------------------------------------------------------------

// Use case will be:
/**
 
const cardOptions = convertSurveyCategoriesToCardOptions(client)
const adaptiveCard = createAdaptiveCard("Header", "Title", "Body", cardOptions)
const result = createNewTeamsCard(client.teamsId, client.channelId, adaptiveCard)

or 
const options = ['I am on my way!']
const cardOptions = createActionSet(options, true)
const adaptiveCard = createAdaptiveCard(client.deviceDisplayName, "Duration Alert", "Body", cardOptions)
const result = createNewTeamsCard(client.teamsId, client.channelId, adaptiveCard)

// Should predefine cards for different types of alerts
// which will execute a series of operations to build the card.
// Eg:

const adaptiveCard = createAdaptiveCard('teamsDurationAlert')
const result = createNewTeamsCard(client.teamsId, client.channelId, adaptiveCard)

const adaptiveCard = createAdaptiveCard('teamsStillnessAlertResponded')
const result = updateTeamsCard(client.teamsId, client.channelId, latestTeamsEvent.messageId, adaptiveCard)

*/

// --------------------------------------------------------------------------------

/**
 * Post a new adaptive card
 * Sends POST request to MS Teams Power Automate card flow webhook.
 * @param teamsId       TeamId for the client's teams
 * @param channelId     ChannelId for the client's channel
 * @param adaptiveCard  Content of adaptive card to be created (object)
 */

// createTeamsCard()
// Use requestType = 'New'
// Use TEAMS_API_KEY in header

/**
 * Update an exisiting adaptive card
 * Sends POST request to MS Teams Power Automate card flow webhook.
 * @param teamsId       TeamId for the client's teams
 * @param channelId     ChannelId for the client's channel
 * @param messageId     MessageId for the card to be updated
 * @param adaptiveCard  Content of adaptive card to be updated (object)
 */

// updateTeamsCard()
// Use requestType = 'Update'
// Use TEAMS_API_KEY in header

// --------------------------------------------------------------------------------