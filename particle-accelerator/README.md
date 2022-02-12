# Particle Accelerator

The Particle Accelerator (PA) is an Electron and React based application for the rapid provisioning and activation of 
cellular-enabled Particle devices for organizations. It is mostly written in TypeScript and is based off of 
electron-react-boilerplate. The majority of the functions are made possible by the Particle Node API and the UI uses the
React-Bootstrap library.

## Installation

To get the Particle Accelerator on your machine, there are two possible ways. 

1. Download the latest uploaded `.dmg` or `.exe` files from the Brave Google Drive.
2. Clone this repository onto your machine, `cd particle-accelerator` and then run `npm run package`. The corresponding
    executables and installers should be built in the `release/build` folder. If you are creating a new executable which
    does not exist yet on the Brave Google Drive, please upload it. 

## Usage and Mechanisms
(Open the Particle Accelerator executable)
1. Log into your Particle account.
2. Scan the code on the Particle Device to obtain its serial number and input it into the form.
3. Select a new name for the Particle device for identification on the Particle console.
4. Select a product family to register the new device to.
5. Select a country to activate the SIM in.
6. Hit "Submit" on the user interface, for which the PA will follow the next steps:
   1. PA requests the device's Device ID and ICCID from Particle's backend
   2. PA activates the SIM using the ICCID, and registers it into the selected product family
   3. PA renames the device to the user's selected name.
   4. PA calls for a list of all of the devices on the selected product and checks against the list to verify that all
      of the specifications are correct.
7. The activation request and all related values/statuses are temporarily stored and the user can opt to either activate
another device, or attempt the activation again.
8. If the device is not already flashing green to search for the cellular network, hold down the "MODE" button on the
    device [Boron] for 5 seconds, then press the "RESET" button and release both. This should put the device into network
    search mode (flashing green light).

## Known Faults
- The serial number field is guarded by a 15-character limit to safeguard against bad entries and the fact that scanning
  the barcode outputs two different numbers, for which the first 15 characters are the only relevant ones.
- The window upon launch should be larger for a cleaner user interface.
- The program works only for devices destined to a product family.
- The barcode scanner sends a return character to the keyboard at the end of scanning, causing the fields to submit.

## Roadmap
- Fix window sizing
- Implement a How-To
- Allow functionality for non-product users
- Permanently store activation logs on the program
