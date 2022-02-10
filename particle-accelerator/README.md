# Particle Accelerator

The Particle Accelerator is an Electron and React based application for the rapid provisioning and activation of 
cellular-enabled Particle devices for organizations. It is mostly written in TypeScript and is based off of 
electron-react-boilerplate. The majority of the functions are made possible by the Particle Node API and the UI uses the
React-Bootstrap library.

## Usage and Mechanisms
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
* The serial number field is guarded by a 15-character limit to safeguard against bad entries and the fact that scanning
  the barcode outputs two different numbers, for which the first 15 characters are the only relevant ones.
* The window upon launch should be larger for a cleaner user interface.
* The program works only for devices destined to a product family.

## Roadmap
* Fix window sizing
* Implement a How-To
* Allow functionality for non-product users
* Permanently store activation logs on the program

## Versions
### Current: v1.0
