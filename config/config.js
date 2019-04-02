/**
* Creates the app info for this installed app.
*/
function createConfigInitializeSetting() {
    return {
      name: 'Weather bulb color',
      description: 'Bulb color by current temp',
      id: 'app',
      firstPageId: '1'
    }
  }
  
  /**
  * Creates the configuration page for end user to configure this installation.
  * @param pageId name of page to send to user
  * @param currentConfig the values of the currently set configurations by the user for the settings
  */
  function createConfigPage(pageId, currentConfig) {
    if (pageId !== '1') {
      throw new Error(`Unsupported page name: ${pageId}`);
    }
  
    return {
      pageId: '1',
      name: 'ODetect Configuration',
      nextPageId: null,
      previousPageId: null,
      complete: true,
      sections: [
        {
          name: 'Device details',
          settings: [
            {
              id: 'Location',
              name: 'What is the name of the device location',
              description: 'Enter location',
              type: 'NUMBER',
              required: true
            },
            {
              id: 'ID',
              name: 'What is the ID of the space within this location',
              description: 'Enter ID',
              type: 'NUMBER',
              required: true
            }
          ]
        },
      ]
    };
  }
  
  module.exports = {
    /**
    * Creates the configuration required to install this app.
    * @param event - the event object.
    */
    handle: function(event) {
      if (!event.config) {
        throw new Error('No config section set in request.');
      }
      let config = {};
      const phase = event.phase;
      const pageId = event.pageId;
      const settings = event.config;
      switch (phase) {
        case 'INITIALIZE':
          config.initialize = createConfigInitializeSetting();
          break;
        case 'PAGE':
          config.page = createConfigPage(pageId, settings);
          break;
        default:
          throw new Error(`Unsupported config phase: ${phase}`);
          break;
      }
      return config;
    },
  };