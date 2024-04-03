# BraveSensor Firmware

## Table of Contents

1. [Table of Contents](#table-of-contents)
2. [Firmware Versioning](#firmware-versioning)
3. [Particle Project Structure](#particle-project-structure)
4. [Directories Outline](#directories-outline)
5. [v4.0 Boron Firmware State Machine](#v40-boron-firmware-state-machine)
   - [Setting up a Boron to Use v4.0](#setting-up-a-boron-to-use-v40)
   - [Important Constants and Settings](#important-constants-and-settings)
     - [DEBUG_LEVEL](#debug_level)
     - [BRAVE_PRODUCT_ID for state machine](#brave_product_id-for-state-machine)
     - [INS_THRESHOLD](#ins_threshold)
     - [STATE0_OCCUPANT_DETECTION_TIMER](#state0_occupant_detection_timer)
     - [STATE1_MAX_TIME](#state1_max_time)
     - [STATE2_MAX_DURATION](#state2_max_duration)
     - [STATE3_MAX_STILLNESS_TIME](#state3_max_stillness_time)
     - [DEBUG_PUBLISH_INTERVAL](#debug_publish_interval)
     - [SM_HEARTBEAT_INTERVAL](#sm_heartbeat_interval)
     - [MOVING_AVERAGE_SAMPLE_SIZE](#moving_average_sample_size)
     - [MOVING_AVERAGE_BUFFER_SIZE](#moving_average_buffer_size)
     - [Door Sensor Definitions](#door-sensor-definitions)
     - [WATCHDOG_PIN and WATCHDOG_PERIOD](#watchdog_pin-and-watchdog_period)
   - [State Machine Console Functions](#state-machine-console-functions)
     - [stillness_timer_set(String)](#stillness_timer_setString)
     - [occupant_detection_timer_set(String)](#occupant_detection_timer_setString)
     - [initial_timer_set(String)](#initial_timer_setString)
     - [duration_timer_set(String)](#duration_timer_setString)
     - [ins_threshold_set(String)](<#ins_threshold_set(String)>)
     - [toggle_debugging_publishes(String)](#toggle_debugging_publishesString)
     - [im21_door_id_set(String)](#im21_door_id_setString)
     - [use_external_ble_antenna](#use_external_ble_antenna)
     - [force_reset(String)](#force_resetString)
   - [State Machine Published Messages](#state-machine-published-messages)
     - [Stillness Alert](#stillness-alert)
     - [Heartbeat Message](#heartbeat-message)
     - [Debug Message](#debug-message)
     - [Debugging](#debugging)
     - [Current Door Sensor ID](#current-door-sensor-id)
     - [IM Door Sensor Warning](#im-door-sensor-warning)
     - [spark/device/diagnostics/update](#spark/device/diagnostics/update)
6. [Boron Firmware Unit Tests](#boron-firmware-unit-tests)
7. [Firmware Code Linting and Formatting](#firmware-code-linting-and-formatting)
8. [v3.2 Argon INS Firmware](#v3.2-argon-ins-firmware)
   - [Setting up an Argon to use v3.2](#setting-up-an-argon-to-use-v32)
   - [Argon INS Console Functions](#argon-ins-console-functions)
   - [Argon INS Published Messages](#argon-ins-published-messages)

# Firmware Versioning

- v2000 = 1 Boron + INS3331 code = v4.0 on Sensor Product Release Timeline [here](https://docs.google.com/spreadsheets/d/1qa0hrfZ9nuKfag2WtU9p4lWTh8E7RW6DfsR_nHg383g/edit?usp=sharing)
- v2001 = 1 Argon + INS3331 code = v3.2 ""

From version 4.2.0 onwards, we will use the following: For any given server version `AA.BB.CC`, the firmware version will be `AABBCC`. Some examples:

- `v4.2.0` => `40200`
- `v4.10.5` => `41005`
- `v11.6.12` => `110612`

From version 7.0.0 onwards, we will use the following: For any given server version `AA.BB.C`, the firmware version will be `AABBC`. Since the firmware version is stored in a uint16_t, the previous versioning schema would overflow. Some examples:

- `v4.2.0` => `4020`
- `v4.10.5` => `4105`
- `v11.6.12` => assumed to never reach two-digit patch version

# Particle Project Structure

Every Particle project is composed of 3 important elements.

#### `/src` folder:

This is the source folder that contains the firmware files for your project. It should _not_ be renamed.
Anything that is in this folder when you compile your project will be sent to our compile service and compiled into a firmware binary for the Particle device that you have targeted.

If your application contains multiple files, they should all be included in the `src` folder. If your firmware depends on Particle libraries, those dependencies are specified in the `project.properties` file referenced below.

#### `.ino` file:

This file is the firmware that will run as the primary application on your Particle device. It contains a `setup()` and `loop()` function, and can be written in Wiring or C/C++. For more information about using the Particle firmware API to create firmware for your Particle device, refer to the [Firmware Reference](https://docs.particle.io/reference/firmware/) section of the Particle documentation.

#### `project.properties` file:

This is the file that specifies the name and version number of the libraries that your project depends on. Dependencies are added automatically to your `project.properties` file when you add a library to a project using the `particle library add` command in the CLI or add a library in the Desktop IDE.

### Adding additional files to your project

#### Projects with multiple sources

If you would like add additional files to your application, they should be added to the `/src` folder. All files in the `/src` folder will be sent to the Particle Cloud to produce a compiled binary.

#### Projects with external libraries

If your project includes a library that has not been registered in the Particle libraries system, you should create a new folder named `/lib/<libraryname>/src` under `/<project dir>` and add the `.h`, `.cpp` & `library.properties` files for your library there. Read the [Firmware Libraries guide](https://docs.particle.io/guide/tools-and-features/libraries/) for more details on how to develop libraries. Note that all contents of the `/lib` folder and subfolders will also be sent to the Cloud for compilation.

### Compiling your project

When you're ready to compile your project, make sure you have the correct Particle device target selected and run `particle compile <platform>` in the CLI or click the Compile button in the Desktop IDE. The following files in your project folder will be sent to the compile service:

- Everything in the `/src` folder, including your `.ino` application file
- The `project.properties` file for your project
- Any libraries stored under `lib/<libraryname>/src`

# Directories Outline

boron-ins-fsm: is v4.0, the main long term stable release of BraveSensors firmware. It works on the Boron device and uses an INS Radar and IM21 or IM24 door sensor.

argon-ins-fsm: is v3.2, a backup version of the firmware where we are unable to use cellular connectivity and have to rely on wifi. It uses an INS Radar and IM21 door sensor.

argon-setup-firmware: this is the initial setup firmware that is used to populate wifi credentials for the argon-ins-fsm firmware.

# v4.0 Boron Firmware State Machine

This is the current long term stable release of the Brave Sensor Firmware.

## Setting up a Boron to use v4.0

1. Boron + INS Sensor Setup:
   Scroll down to the Boron portion of the [USB setup guide](https://support.particle.io/hc/en-us/articles/360045547634-How-can-I-set-up-my-Argon-or-Boron-via-USB-) and start at step 9.  1. In the app, we do NOT want to use this Boron as a mesh device
2. Add the device to the Production group on the Products section of the console.
   Or betatest group
3. Open the directory `BraveSensor/firmware/boron-ins-fsm` in VSCode
4. Make sure VSCode is set to flash to the correct device (Boron), correct version of the device OS (v3.3.1), and correct target device name (you named it in step 1 above
5. Run "Clean Application & DeviceOS (local)"
6. Press F1 - type clean, command should appear, select and hit enter
   Run "Flash Application & DeviceOS (local):
7. Press F1 - type flash, command should appear, select and hit enter
8. Check to see that the state machine is running by looking at the the logs in the serial monitor window
9. This is the time to physically install the Boron onto the PCB
10. Open the device on the Particle Console.  Add it to the BetaTest or Production product group.
11. Test connectivity by turning debug publishes on and then off again.  Test the rest of the console functions by using ‘e’
12. Confirm you’ve set the door ID via console function
13. If the device is going into production, Add the door Sensor ID to the client information sheet
14. If applicable, unplug and pack for shipping to client.  Do not forget to pack the IM door sensor!

## State Machine

The state machine design including all states and their entry/exit conditions is documented [here](https://docs.google.com/drawings/d/14JmUKDO-Gs7YLV5bhE67ZYnGeZbBg-5sq0fQYwkhkI0/edit?usp=sharing).

All state machine functions are defined in stateMachine.h and written in stateMachine.cpp. To add another state to the machine, you need to define and write a new state function.

State transitions are handled by a pointer to a function. The pointer is called StateHandler. To transition to and from any new state you add to the code, set StateHandler = name of state function you wish to transition to/from. See the current state functions for an example.

## Important Constants and Settings

Production firmware will initialize state machine constants (timer lengths, INS threshold, etc) to sensible default values, which can later be tweaked and configured via console functions. It will initialize the door sensor ID to 0xAA 0xAA 0xAA. This can later be updated via console function, once the device is connected to LTE.

Default settings useful to know about will be described in this section. Note that changing these is done at the code level and not in a configuration file, so doing so will require a hotfix that is assigned a version number. Changes will affect all devices in the fleet.

### DEBUG_LEVEL

This is defined via a macro at the top of the .ino file.

The debug level controls which statements the Particle OS's log handler will print. The levels in decending order from most to least detailed are: trace, info, warn, error. Further information can be found [here](https://docs.particle.io/reference/device-os/firmware/argon/#logging)

This firmware defaults to warn level. If more detailed debugging info is needed, eg for clients that have difficulting remaining connected to wifi, it can be set to info.

If you are connect to the Particle device via USB, these logs can be read by opening a Particle [command line interface](https://docs.particle.io/reference/developer-tools/cli/) and using the command "particle serial monitor --follow".

### BRAVE_FIRMWARE_VERSION: state machine

Define this in the main .ino file.

This is the version number of the firmware that the Particle Console will use to determine which devices to flash. It must be an int, see the section on [versioning](#firmware-versioning).

### BRAVE_PRODUCT_ID for state machine

Define this in the main .ino file, depending on whether your firmware is going to the beta test group or the production group on the Particle Console.

The Particle Console requires a product ID key to be set in firmware. It defines which product group the device belongs to. Fleetwide OTA updates of firmware are tied to product groups and sub-groups. The firmware that is flashed to devices in the beta test product group must contain the Particle console's key for that product group, ditto for the production group and any others created in the future.

Product keys are found by looking at the list of different products on the Particle console:

![alt text](productkeys.png 'Product Keys')

For more information on fleetwide updates, see the Particle docs [here](https://docs.particle.io/tutorials/device-cloud/ota-updates/#fleet-wide-ota).

### INS_THRESHOLD

This is defined via a macro in the stateMachine.h header file.

It is compared to the filtered inPhase values detected by the INS radar. Anything above the threshold is considered movement, and anything below the threshold is considered stillness or an empty room.

The default level is set to 60. This is based on the radar testing documented [here](https://docs.google.com/document/d/12TLw6XE9CSaNpguytS2NCSCP0aZWUs-OncmaDdoTKfo/edit?usp=sharing).

### STATE0_OCCUPANT_DETECTION_TIMER

This is defined via a macro in the stateMachine.h header file

It is the length of time after the door_status changes from an open to a closed state where entrance to state1 is allowed. After the state 0 timer has surpassed this value, the state machine will stay in state 0 until this timer resets (door open and close) 

The length of time is default to 1 hour defined as 3600000 milliseconds

### STATE1_MAX_TIME

This is defined via a macro in the stateMachine.h header file.

It is the length of time the state 1 timer counts up to. It is how long motion needs to be present (so INS threshold > 60) for a bathroom session to start.

The length of time defaults to 15s. It is defined in milliseconds, so the actual macro definition will be 15000 in code.

### STATE2_MAX_DURATION

This is defined via a macro in the stateMachine.h header file.

It is the length of time the state 2 timer counts up to. It is how long a bathroom session can see motion before a duration alert is triggered.

The length of time defaults to 20 minutes. It is defined in milliseconds, so the actual macro definition will be 1200000 in code.

### STATE3_MAX_STILLNESS_TIME

This is defined via a macro in the stateMachine.h header file.

It is the length of time the state 3 timer counts up to. It is how long a bathroom session can see stillness before a stillness alert is triggered.

The length of time defaults to 2 minutes. It is defined in milliseconds, so the actual macro definition will be 120000 in code.

### DEBUG_PUBLISH_INTERVAL

This is defined via a macro in the debugFlags.h header file.

It is the length of time between publishes of debug messages to the cloud. (Debug publishes are turned on and off via console function, see section on console functions below).

The debug interval defaults to 1.5 seconds. It is defined in milliseconds, so the actual macro definition will be 1500 in code.

### DEBUG_AUTO_OFF_THRESHOLD

This is defined via a macro in the debugFlags.h header file.

It is the maximum length of time to publish debug messages to the cloud. (Debug publishes are turned on via console function, see section on console functions below).

The auto-off threshold is set to 8 hours (i.e. a standard work day). It is defined in milliseconds, so the actual macro definition will be 8 \* 60 \* 60 \* 1000 = 28800000 in code.

### SM_HEARTBEAT_INTERVAL

This is defined via a macro in the stateMachine.h header file.

It is the length of time between publishes of heartbeat messages to the cloud. Note that heartbeat messages contain Brave firmware information. It is separate from the vitals that the Particle OS publishes. See the section on published messages below for more information.

The heartbeat interval defaults to 10 minutes. It is defined in milliseconds, so the actual macro definition will be 600000 in code. Note this is a fairly firm lower limit - based on Particle's pricing scheme we are limited to approximately one publish every 6 minutes, and we must save room in that rate limit for the alerts to be published as well.

### MOVING_AVERAGE_SAMPLE_SIZE

This is defined via macro in the ins3331.h header file.

The INS data is filtered by taking the absolute value of each inPhase data point and then performing a moving average over 25 data points. This algorithm was developed and tested during the radar testing documented [here](https://docs.google.com/document/d/12TLw6XE9CSaNpguytS2NCSCP0aZWUs-OncmaDdoTKfo/edit?usp=sharing).

The sample size for the rolling average defaults to 25, based on the algorithm documentation linked above. Note if you plan to change the sample size, the buffer size must change accordingly. See the [buffer size section](#moving-average-buffer-size) below.

### MOVING_AVERAGE_BUFFER_SIZE

This is defined via macro in the ins3331.h header file.

The buffer size must always be one larger than the sample size defined in the [section above](#moving-average-sample-size).

To optimize the moving average calculation for resource-constrained systems, the first data point in the moving average is calculated by summing 25 values and then dividing by 25. Subsequent averages are calculated like:

sum = sum - oldVal + newVal, where:

- oldVal = oldest inPhase value, which must be removed from the sum.
- newVal = new incoming inPhase value that now needs to be included in the average.

Thus the buffer size must be one larger than the sample size to retain oldVal for the next calculation.

### Door Sensor Definitions

All of the following definitions are in the imDoorSensor.h header file.

The three byte door sensor ID is set to default values with one macro definiton per byte:

1. byte1 = 0xAA
2. byte2 = 0xAA
3. byte3 = 0xAA

This value can be overwritten using a console function (see section on console functions below) once the Boron is activated and connected via LTE.

Various different macro defines for door sensor data are also in the imDoorSensor.h header file. The full list of data the IM door sensor can transmit is:

    0x00 - closed
    0x01 - closed + tamper
    0x04 - closed + low battery
    0x05 - closed + low battery + tamper
    0x08 - closed + heartbeat
    0x09 - closed + heartbeat + tamper
    0x0C - closed + heartbeat + low battery
    0x0D - closed + heartbeat + low battery + tamper

    0x02 - open
    0x03 - open + tamper
    0x06 - open + low battery
    0x07 - open + low battery + tamper
    0x0A - open + heartbeat
    0x0B - open + heartbeat + tamper
    0x0E - open + heartbeat + low battery
    0x0F - open + heartbeat + low battery + tamper

Note that the IM21 does not use the tamper bit, but the IM24 does.

Note that the low battery signal is published in the state machine heartbeat publish. See the section on published messages below for more information.

### WATCHDOG_PIN and WATCHDOG_PERIOD

These are defined at the top of `tpl5010watchdog.cpp`.

A TPL5010 watchdog timer chip can be implemented on a Boron+INS or Argon+INS PCB.

The firmware sets up `WATCHDOG_PIN` on the Particle as an output during the `setup()` routine. While the Particle is connected to the cloud, it will service the TPL5010 periodically by pulsing the `WATCHDOG_PIN`. The period of this servicing is set by `WATCHDOG_PERIOD`, and is currently set to 2 minutes.

If the TPL5010 is not serviced within a set period, it will pull the RESET pin of the Particle high, triggering a reset. This reset period is set in hardware by the resistance between pin 3 on the TPL to ground. Currently a 39.2kOhm resistor is used to create a reset period of about 4 minutes.

The 4 minute threshold for the TPL should be sufficient to allow for over-the-air updates. However, provisioning the Particle often takes longer than 4 minutes, and thus should be done disconnected from the PCB.

This section mirrors the Living Doc article on the [TPL5010 Watchdog](https://app.clickup.com/2434616/v/dc/2a9hr-2261/2a9hr-3187).
The Particle Application Notes with example code for the TPL5010 can be found [here](https://docs.particle.io/datasheets/app-notes/an023-watchdog-timers/#simple-watchdog-tpl5010), and the datasheet [here](https://www.ti.com/lit/ds/symlink/tpl5010.pdf?HQS=dis-dk-null-digikeymode-dsf-pf-null-wwe&ts=1629830152267&ref_url=https%253A%252F%252Fwww.ti.com%252Fgeneral%252Fdocs%252Fsuppproductinfo.tsp%253FdistId%253D10%2526gotoUrl%253Dhttps%253A%252F%252Fwww.ti.com%252Flit%252Fgpn%252Ftpl5010).

## State Machine Console Functions

Below are the console functions unique to the single Boron state machine firmware. Any console functions not documented here are documented in the other console functions sections of this readme.

### **stillness_timer_set(String)**

**Description:**

Stillness timer is the length of time the Sensor sees stillness before publishing a stillness alert. The default value is 120 seconds = 2 minutes. Use this console function to set the stillness timer to something other than the default value.

**Argument(s):**

1. The integer number of seconds the new timer value should be.
2. e - this is short for echo, and will echo the current timer value

**Return(s):**

- The integer number of seconds of the new timer value, when a new timer value is entered
- The integer number of seconds of the current timer value, when e for echo is entered
- -1: when bad data is entered

### **occupant_detection_timer_set(String)**

**Description:**

This sets the allowed time after the paired door sensor closes in which state 0 can transition to state 1. The default value is 60 minutes.

**Argument(s):**

1. The integer number of seconds of the new occupation detection timer.
2. e - this is short for echo, and will echo the current occupation detection timer

**Return(s):**

- The integer number of seconds of the timer value, when a new timer value is entered
- The integer number of seconds of the current timer value, when e for echo is entered
- -1: when bad data is entered

### **initial_timer_set(String)**

**Description:**

Initial timer is the length of time the Sensor needs to see motion above the threshold before it initiates a session. The default value is 15 seconds. Use this console function to set the initial timer to something other than the default value.

**Argument(s):**

1. The integer number of seconds the new timer value should be.
2. e - this is short for echo, and will echo the current timer value

**Return(s):**

- The integer number of seconds of the new timer value, when a new timer value is entered
- The integer number of seconds of the current timer value, when e for echo is entered
- -1: when bad data is entered

### **duration_timer_set(String)**

**Description:**

Duration timer is the length of time the Sensor needs to see motion above the threshold before it publishes a duration alert. The default value is 1200 seconds = 20 minutes. Use this console function to set the duration timer to something other than the default value.

**Argument(s):**

1. The integer number of seconds the new timer value should be.
2. e - this is short for echo, and will echo the current timer value

**Return(s):**

- The integer number of seconds of the new timer value, when a new timer value is entered
- The integer number of seconds of the current timer value, when e for echo is entered
- -1: when bad data is entered

### **ins_threshold_set(String)**

**Description:**

Use this console function to set the ins threshold to something other than the default.

The INS threshold is compared to the filtered inPhase values detected by the INS radar. Any filtered inPhase value above the threshold is considered movement, and any filtered inPhase value below the threshold is considered stillness or an empty room.

The default level is set to 60. This is based on the radar testing documented [here](https://docs.google.com/document/d/12TLw6XE9CSaNpguytS2NCSCP0aZWUs-OncmaDdoTKfo/edit?usp=sharing).

**Argument(s):**

1. The integer value of the new threshold
2. e - this is short for echo, and will echo the current threshold

**Return(s):**

- The integer value of the new threshold, when a new threshold is entered
- The integer value of the current threshold, when e for echo is entered
- -1: when bad data is entered

### **toggle_debugging_publishes(String)**

**Description:**

Use this console function to turn cloud publishes of state machine debugging values on and off. Note the firmware defaults to off. When on, the debug publishes occur approximately every 1.5 seconds for a maximum of 8 hours, so be mindful of Particle data limits when using this feature.

**Argument(s):**

1. Enter 1 to turn publishes on
2. Enter 0 to turn publishes off
3. e - this is short for echo, and will echo the current value

**Return(s):**

- The current integer value (0 or 1)
- -1: when bad data is entered

### **im21_door_id_set(String)**

**Description:**

Note that this function is used for both IM21 and IM24 door sensors.

Sets a new door ID for Particle to connect to, or publishes current door ID to cloud. If new door ID is set, reconnection to new door sensor should occur instantly. Door ID is the three byte device ID for the IM bluetooth low energy sensor that the Particle is currently connected to.

When the firmware scans nearby bluetooth low energy devices, it finds the advertising data containing the IM’s door ID, extracts the door status (open or closed), and publishes that to the cloud.

The IM door sensors each have a sticker on them with their door IDs. On the bottom row of numbers and letters, take the first three bytes listed and enter them into the console function, separated by commas. For example, if the bottom row of numbers and letters on the sticker is 1a2b3c45, the door ID will be entered like: 1a,2b,3c

**Argument(s):**

1. Three byte door ID separated by commas, for example: 1a,2b,3c See Description section above for where to locate an IM door sensor’s door ID.
2. e - Echos (publishes to cloud) the door ID the Particle is currently connected to

**Return(s):**

- <The door ID converted to a decimal number> - if door ID was parsed and written to flash
- <The door ID converted to a decimal number> - if door ID was echoed to the cloud
- -1 - if bad input was received and door ID was neither parsed or echoed to the cloud

### **use_external_ble_antenna(String)**

**Description:**

Use this console function to toggle usage of the internal/external BLE antenna. The external antenna provides improved BLE signal compared to the internal antenna. However, using the external antenna when one is not physically attached to the Boron will result in much poorer signal.

**Argument(s):**

1. Enter 1 to use the external antenna
2. Enter 0 to use the internal antenna

**Return(s):**

- 1 or 0, the value that was inputted
- 1 or 0, the current selection of the antenna if 'e' is inputted
- -1, invalid input detected

### **force_reset(String)**

**Description:**

Use this console function to force the boron to reset. Useful for development and testing as OTA updates with version > 6.0.0 require that the last IM door sensor heartbeat has been over DEVICE_RESET_THRESHOLD milliseconds ago before it resets to the new firmware.

**Argument(s):**

1. Enter 1 to reset

**Return(s):**

- Nothing if 1 is entered, but does send a message to the particle console to warn about particle's future failed to call message
- -1 - when bad data is entered

### **reset_stillness_timer_for_alerting_session(String)**

**Description:**

Use this console function to reset the current stillness timer to the current time if and only if the current session has sent at least one alert. This acts to extend the period of time before subsequent Stillness Alerts.

**Argument(s):**

1. Enter any String

**Return(s):**

- The length of the stillness timer before it was reset, converted from a ` long` to an `int`.

## State Machine Published Messages

### **Stillness Alert**

**Event Name**

Stillness Alert

**Event Data**

None, other than a string saying "stillness alert". This is redundant but doesn't increase our data usage under the Particle plan. It is just there to make the Particle.publish() call a little more readable in code.

### **Duration Alert**

**Event Name**

Duration Alert

**Event Data**

None, other than a string saying "duration alert". This is redundant but doesn't increase our data usage under the Particle plan. It is just there to make the Particle.publish() call a little more readable in code.

### **Heartbeat Message**

This is published once every 10 minutes. It contains vitals from the INS3331 radar sensor, the IM door sensor, and the state machine. It is separate from the vitals messages published by the Particle OS, see below.

**Event Name**

Heartbeat

**Event Data**

1. doorMissedMsg: the number of IM door sensor missed message alerts generated since the previous heartbeat.
1. doorLowBatt: a boolean that indicates whether the last IM door sensor message received has a "1" on the low battery flag. Returns -1 if hasn't seen any door messages since the most recent restart
1. doorTampered: a boolean that indicates whether the last IM door sensor message received has a "1" on the tamper flag. Returns -1 if hasn't seen any door messages since the most recent restart
1. doorLastMessage: millis since the last IM door sensor message was received. Counts from 0 upon restart. Returns -1 if hasn't seen any door messages since the most recent restart
1. resetReason: provides the reason of reset on the first heartbeat since a reset. Otherwise, will equal "NONE".
1. states: an array that encodes all the state transitions that occured since the previous heartbeat\*, with each subarray representing a single state transition. Subarray data includes:

   1. an integer between 0-3, representing the previous state. The number corresponds to the states described in the [state diagram](https://docs.google.com/drawings/d/14JmUKDO-Gs7YLV5bhE67ZYnGeZbBg-5sq0fQYwkhkI0/edit?usp=sharing).
   2. an integer between 0-5, representing the reason of transition out of the previous state. The table to decode the reason is below.
   3. an unsigned integer, representing the time spent in the previous state.

\*Only until the 622 character limit is reached. Subsequent state transitions will appear in the following heartbeat.

| State Code | Meaning         |
| ---------- | --------------- |
| 0          | Idle            |
| 1          | Initial Timer   |
| 2          | Duration Timer  |
| 3          | Stillness Timer |

| Reason Code | Meaning                        |
| ----------- | ------------------------------ |
| 0           | Movement surpasses threshold   |
| 1           | Movement falls below threshold |
| 2           | Door opened                    |
| 3           | Initial timer surpassed        |
| 4           | Duration alert                 |
| 5           | Stillness alert                |

Example:

```JSON
{
  "doorMissedMsg": 1,
  "doorLowBatt": false,
  "doorLastHeartbeat": 234567,
  "resetReason": "DFU_MODE",
  "states": [
    [0,0,5030],
    [1,1,2411],
    [0,0,42934],
    [1,3,15000],
    [2,4,60000],
    [0,0,3034],
  ]
}
```

### **Debug Message**

Debug messages are only published when activated by [console function](<#toggle_debugging_publishes(String)>).

When activated, debug messages are published approximately every 1.5 seconds.

**Event Name**

Debug Message

**Event Data**

1. state: the current state the machine is in
1. door_status: the current door status byte
1. INS_val: the current filtered inPhase value from the INS radar
1. INS_threshold: the current threshold that we compare the INS_val against
1. timer_status: if the current state uses a timer, this contains the time in milliseconds that the timer has counted up to thus far. If the current state does not contain a timer, this is set to 0.
1. occupation_detection_timer: the occupation detection timer value that that the idle state compares against
1. initial_timer: the initial timer value that the initial state compares against
1. duration_timer: the duration timer value that the duration and stillness states compare against
1. stillness_timer: the stillness timer value that the stillness state compares against

### **Debugging**

Debug messages are only published when activated by [console function](<#toggle_debugging_publishes(String)>).

When activated, state transition messages are published every time the machine changes state.

**Event Name**

State Transition

**Event Data**

1. prev_state: the state the machine is transitioning from
2. next_state: the state the machine is transitioning to
3. door_status: the current door status byte
4. INS_val: the current filtered inPhase value from the INS radar

### **Current Door Sensor ID**

Publishes what it says on the box! If you have entered e for echo into the door sensor console function, it will read the device ID of the door sensor the Particle is currently reading advertising data from, and publish it to the cloud.

**Event Name**

Current Door Sensor ID

**Event data:**

1. **doorId** - The three bytes of the IM door sensor ID in human readable order with commas in between. For example, if the IM door sensor ID is "AC9A22DE8B1D" then this will return `{"doorId": "DE,8B,1D"}`

### **IM Door Sensor Warning**

This event is published if the firmware's checkIM() function sees that a door event has been missed.

The IM door sensor increments a control byte by 0x01 every time a door event (open, close, heartbeat) is transmitted. The firmware will publish an "IM Door Sensor Warning” event if it receives a control byte that is greater than the previous event's control byte + 0x01.

Be aware: this means that notification a door event is missed won't be published until the next door event is received from the IM door sensor. As you can see in the Event Data section below, the last received and the most recently received door control bytes are published to the cloud. So, for example, if prev_control_byte = 0x05 and curr_door_byte = 0x08, that means you have missed door events 0x06 and 0x07.

**Event Name**: IM Door Sensor Warning

**Event data:**

1. **Byte1** - first byte of door ID, in hex
2. **Byte2** - second byte of door ID, in hex
3. **Byte3** - third byte of door ID, in hex
4. **prev_control_byte** - Last door control byte received
5. **curr_control_byte** - Most recent door control byte received

### "**spark/device/diagnostics/update**"

**Event description:** This event is triggered by the publishVitals() function. More documentation on this function can be found [here](https://docs.particle.io/reference/device-os/firmware/argon/#particle-publishvitals-).

**Event data:**

```json
{
  "device": {
    "network": {
      "signal": {
        "at": "Wi-Fi",
        "strength": 100,
        "strength_units": "%",
        "strengthv": -42,
        "strengthv_units": "dBm",
        "strengthv_type": "RSSI",
        "quality": 100,
        "quality_units": "%",
        "qualityv": 50,
        "qualityv_units": "dB",
        "qualityv_type": "SNR"
      },
      "connection": {
        "status": "connected",
        "error": 1024,
        "disconnects": 38,
        "attempts": 1,
        "disconnect_reason": "reset"
      }
    },
    "cloud": {
      "connection": {
        "status": "connected",
        "error": 0,
        "attempts": 1,
        "disconnects": 58,
        "disconnect_reason": "error"
      },
      "coap": {
        "transmit": 0,
        "retransmit": 0,
        "unack": 0,
        "round_trip": 0
      },
      "publish": {
        "rate_limited": 14
      }
    },
    "system": {
      "uptime": 3714727,
      "memory": {
        "used": 40200,
        "total": 82944
      }
    }
  },
  "service": {
    "device": {
      "status": "ok"
    },
    "cloud": {
      "uptime": 250329,
      "publish": {
        "sent": 250074
      }
    },
    "coap": {
      "round_trip": 2194
    }
  }
}
```

# Boron Firmware Unit Tests

All unit tests for the Boron firmware are located in the `/test` folder. The unit tests use the Catch2 framework (https://github.com/catchorg/Catch2).

To compile the unit tests using gcc, you must include the mock header files located in `/test/mocks`, which contain fake implementations of Particle functions.

You must also include the header files located in the `/inc` folder. These header files are copied from the Particle toolchain and contain real implementations of Particle functions.

If you need to include additional Particle header files, they can be located at `/<local user>/.particle/toolchains/deviceOS/<firmware version>/wiring` after installing the local toolchain for <firmware version> using the Particle Workbench VSCode extension.

It is suggested that upon upgrading the Boron firmware version, the files in the `/inc` folder are also updated to the latest version.

To compile and run the unit tests, see the .travis.yml file for the most up to date command.

# Firmware Code Linting and Formatting

As a part of the second stage of the Travis CI process, the formatting of all firmware code located in the `/src` and `/test` folders is checked using clang-format, as specified in the .clang-format file. clang-format version 12.0.0 is used in order to be compatible with Travis. To format all code in these folders, run the clang-format-all.py script.

Additionally, all firmware code located in the `/src` folder is checked using cppcheck for potential problems. Both checks must be free of errors for the stage to pass.

# v3.2 Argon INS Firmware

This is the Single Boron firmware with firmware state machine, modified to include wifi console functions and wifi connect functionality.

## Setting up an Argon to use v3.2

Argons must have setup firmware flashed before the production firmware can be flashed to them.

1. Attach a wifi antenna to the Argon.
   Follow the [USB setup guide](https://support.particle.io/hc/en-us/articles/360045547634-How-can-I-set-up-my-Argon-or-Boron-via-USB-) EXCEPT start at step 11.  1. If it doesn’t want to go into listening mode (blinking dark blue), try putting it in listening mode with the command particle usb start-listening 1. Don’t ever ask it to search for nearby wifi networks, this never works for some reason.  Say “no”, and then enter your wifi credentials manually 1. Argons need to be connected to 2.4G wifi network, not 5G 1. Use the default wifi network config settings it gives you, unless you know for sure you have a different wifi network configuration 1. Remember to do particle usb setup-done
1. Confirm on the console device is claimed.
1. Add the device to the Betatest or ProductionProduction group on the Products section of  the console.
   1. If XeThru, physically plug the Argon in to XeThru
   1. Or plug in to INS if INS Argon
   1. Do not plug in if using a PCB with watchdog
1. open the `argon-setup-firmware` directory in VSCode.
1. Copy setupFirmware.h into the directory. Open it and make sure settings are correct.  1. setupFirmware.h is found on 1password
   see readme for a refresh on what settings are what
1. Make sure VSCode is set to flash to the correct device (Argon), correct version of Particle OS v 2.0.1 of Particle OS, and correct target device name (you named it in step 2 above)
1. Open a serial monitor window.
1. Press F1 - type serial, command should appear, select it and hit enter
   Always accept the default settings
1. On the Particle console, open a tab where you can watch the cloud publishes from your device.
1. Run "Clean Application & DeviceOS (local)"
   Press F1 - type clean, command should appear, select and hit enter
1. Run "Flash Application & DeviceOS (local):
   Press F1 - type flash, command should appear, select and hit enter
1. Once flash is completed, check the log output in the serial monitor window.  It should tell you what information was flashed, and it should say “setup complete”.    Also check on the console for a cloud publish saying “setup complete”.
1. open the `argon-ins-fsm` directory in VSCode
1. Open firmware_config.h, make sure settings are correct.
1. Open a serial monitor window.
1. On the Particle console, open a tab where you can watch the cloud publishes from your device
1. Run "Clean application (local)".
1. Run "Flash application (local)".
1. Check the log output in the serial monitor window for correct output.  
   On the console, check Argon has connected to cloud and is publishing the expected data, use the console function to turn debug messages on to see if publishes are being received.
1. Unplug and pack for shipping to client.  Do not forget to pack the IM door sensor!

The production firmware also has configuration values, found in the firmware_config.h file.

See the list below for information on the settings found in these two files:

### DEBUG_LEVEL

Define this in both the setup and production firmware config files.

The debug level controls which statements the Particle OS's log handler will print. The levels in decending order from most to least detailed are: trace, info, warn, error. Further information can be found [here](https://docs.particle.io/reference/device-os/firmware/argon/#logging)

This firmware defaults to warn level. If more detailed debugging info is needed, eg for clients that have difficulting remaining connected to wifi, it can be set to info.

If you are connect to the Particle device via USB, these logs can be read by opening a Particle [command line interface](https://docs.particle.io/reference/developer-tools/cli/) and using the command "particle serial monitor --follow".

### BRAVE_FIRMWARE_VERSION

Define this in the production firmware's config file.

This is the version number of the firmware that the Particle Console will use to determine which devices to flash. It must be an int. Due to this restriction versioning is a bit complicated, see the section on [versioning](#firmware-versioning).

### BRAVE_PRODUCT_ID

Define this in the production firmware's config file, depending on whether your firmware is going to the beta test product or the production product on the Particle Console.

The Particle Console requires a product ID key to be set in firmware. It defines which product group the device belongs to. Fleetwide OTA updates of firmware are tied to product groups and sub-groups. The firmware that is flashed to devices in the beta test product group must contain the Particle console's key for that product group, ditto for the production group and any others created in the future.

Product keys are found by looking at the list of different products on the Particle console:

![alt text](productkeys.png 'Product Keys')

For more information on fleetwide updates, see the Particle docs [here](https://docs.particle.io/tutorials/device-cloud/ota-updates/#fleet-wide-ota).

### Wifi Settings

In this section you define client wifi credentials, and two internal Brave passwords that can be entered to the Particle console functions to publish credentials in flash memory.

**Always use `“”` string quotes to indicate string format. Do not leave any define blank in this section or the code will break.**

Define the CLIENTSSIDX and CLIENTPWDX macros to the client wifi credentials, where X is the index number of the wifi/password pair.

SSID/password pairs share a common index number. For example, CLIENTPWD0 contains the password corresponding to CLIENTSSID0, CLIENTPWD1 is the password for CLIENTSSID1, and so on.

We are limited to 62 characters per SSID or password: the WEP/WEP2 standards for SSID and password length is 64 characters. In this firmware we reserve one character for null character and one character for the index number (see console function changeSSID() below). It is not necessary to include the null character in the string.

You may have up to four unique SSIDs, but the SSIDs are not required to be unique. For example, if you have three different passwords for one SSID, and a second SSID with its own password, you may define them as:

```C++
#define CLIENTSSID0 "ClientSSID1"
#define CLIENTSSID1 "ClientSSID1"
#define CLIENTSSID2 "ClientSSID1"
#define CLIENTSSID3 "ClientSSID2"

#define CLIENTPWD0 "password1_for_SSID1"
#define CLIENTPWD1 "password2_for_SSID1"
#define CLIENTPWD2 "password3_for_SSID1"
#define CLIENTPWD3 "password_for_SSID2"
```

We are limited to 5 SSID/password pairs by the functionality of WiFi.setCredentials() in the Particle API. The last set of credentials is reserved for the Brave diagnostics network, so we have the option of setting up to four different sets of wifi credentials for the customer.

### locationID, deviceID, devicetype

Each of these must be initialised to a string array containing the correct information for your particular install.

**Always use `“”` string quotes to indicate string format. Do not leave any define blank or the code will break.**

LocationID is a UID corresponding to each bathroom and must match the row entry on the backend locations table. Current locationID entries look like “REACH_1”, “REACH_3”, “EastsideWorks”.

DeviceID is currently redundant and will be removed in future versions of the firmware. DO NOT USE. Intialize DeviceID with “42” so as to not have any issues with null string arrays.

Device type is “XeThru”, "IM21", "INS3331", etc. It indicated which type of device the Argon is receiving data from.

## Argon INS Firmware Settings and Config

When commissioning the Single Argon, the setup firmware must be flashed beforehand. Setup firmware is found in the /argon-setup-firmware directory. Step-by-step instructions on how to flash this and the firmware are shared in the Brave Living Doc.

The rest of the firmware settings are identical to the 1 Boron + INS, and can be found [here](#firmware-state-machine-setup).

## Argon INS Console Functions

All console functions pertaining to the state machine and IM21 door sensor are described in detail [here](#state-machine-console-functions). All console functions pertaining to wifi are are described below.

### changeSSID(String)

**Description:**

Writes new SSIDs to flash memory on the Particle devices, or publishes current contents of flash to cloud. If wifi is disconnected the Particle will read these from flash and attempt to connect to them.

SSID/password pairs share a common index number. For example, CLIENTPWD0 contains the password corresponding to CLIENTSSID0, CLIENTPWD1 is the password for CLIENTSSID1, and so on.

We are limited to 62 characters per SSID or password: the WEP/WEP2 standards for SSID and password length is 64 characters. In this firmware we reserve one character for null character and one character for the index number (see console function changeSSID() below). It is not necessary to include the null character in the string.

**Argument(s):**

All console functions only accept a single arduino String. It is not necessary to enter the string with surrounding `“”` quotes. The different strings this function accepts are:

1. A string whose first character is an index number 0 - 3 indicating which SSID/password pair this SSID belongs to, and the remaining characters are the SSID itself. For example, to place ClientSSID in the 0th element of the firmware’s five-SSID array, enter 0ClientSSID
2. A string containing a password defined in the setup firmware. This password is currently stored on 1password, in the primary copy of the setupFirmware.h file. If this password is entered, the SSIDs currently stored in flash memory will be published to the cloud.

**Additional Information:**

You may have up to four unique SSIDs, but the SSIDs are not required to be unique. For example, if you have three different passwords for one SSID, and a second SSID with its own password, you may define them as:

- 0ClientSSID0 and 0password_for_SSID0
- 1ClientSSID0 and 1second_password_for_SSID0
- 2ClientSSID0 and 2third_password_for_SSID0
- 3ClientSSID1 and 3password_for_SSID1

The fifth SSID/password pair is reserved for the internal Brave diagnostics network. This network is hardcoded into the firmware. The console functions have read-only access to this network. It cannot be changed remotely.

**Return(s):**

- 10: when correct password is entered and SSIDs are published to the cloud
- 0 - 3: the index the SSID was stored in, if it was stored successfully
- -1: incorrect password to publish SSIDs entered, or SSID not stored correctly

### changePwd(String)

**Description:**

Writes new passwords to flash memory on the Particle devices, or publishes current contents of flash to cloud. If wifi is disconnected the Particle will read these from flash and attempt to connect to them.

SSID/password pairs share a common index number. For example, CLIENTPWD0 contains the password corresponding to CLIENTSSID0, CLIENTPWD1 is the password for CLIENTSSID1, and so on.

We are limited to 62 characters per SSID or password: the WEP/WEP2 standards for SSID and password length is 64 characters. In this firmware we reserve one character for null character and one character for the index number (see console function changeSSID() below). It is not necessary to include the null character in the string.

**Argument(s):**

All console functions only accept a single arduino String. It is not necessary to enter the string with surrounding `“”` quotes. The different strings this function accepts are:

1. A string whose first character is an index number 0 - 3 indicating which SSID/password pair this password belongs to, and the remaining characters are the password itself. For example, if ClientSSID is in the 0th element of the firmware’s five-SSID array, enter its password as 0password_for_ClientSSID0
2. A string containing a password defined in the setup firmware. This password is currently stored on 1password, in the primary copy of the setupFirmware.h file. If this password is entered, the passwords currently stored in flash memory will be published to the cloud.

**Additional Information:**

You may have up to four unique SSIDs, but the SSIDs are not required to be unique. For example, if you have three different passwords for one SSID, and a second SSID with its own password, you may define them as:

- 0ClientSSID0 and 0password_for_SSID0
- 1ClientSSID0 and 1second_password_for_SSID0
- 2ClientSSID0 and 2third_password_for_SSID0
- 3ClientSSID1 and 3password_for_SSID1

The fifth SSID/password pair is reserved for the internal Brave diagnostics network. This network is hardcoded into the firmware. The console functions have read-only access to this network. It cannot be changed remotely.

**Return(s):**

- -10: when correct password is entered and client passwords are published to the cloud
- 0 - 3: the index the password was stored in, if it was stored successfully
- -1: incorrect password to access client passwords entered, or client password not stored correctly

### getWifiLog(String)

**Description:**

This function publishes the wifi log to the cloud, or resets the log to 0. The wifi log is a single int that increments every time the Particle loses connection to wifi and firmware function connectToWifi() must be called. It is a minimalist log to determine if a particular Particle has difficulty maintaining a wifi connection.

**Argument(s):**

All console functions only accept a single arduino String. It is not necessary to enter the string with surrounding `“”` quotes. The different strings this function accepts are:

1. e - echos, aka publish to cloud, the wifi log’s current int
2. c - clears the wifi log by setting the int = 0

**Return(s):**

- Wifi log number if e or c is received and parsed correctly
- -1 - when bad input is received

### Single Argon INS Published Messages

The published messages are identical to the 1 Boron + INS firmware as described [here](#state-machine-published-messages). Except for additional events related to Wifi:

### “Current SSIDs”

**Event description:** Publishes what it says on the box! If you have entered the correct password to the console function, this event will be published. It will contain the 5 SSIDs currently stored in memory (including the Brave diagnostics network), and the SSID that the Particle is currently connected to.

**Event data:**

1. **mySSIDs[0]** - string containing this password
2. **mySSIDs[1]** - string containing this password
   Etc up to mySSIDs[4]
3. **Connected to:** - string containing SSID the Particle WiFi module is currently connected to

### “Current wifi passwords”

**Event description:** Publishes what it says on the box! If you have entered the correct password to the console function, this event will be published. It will contain the 5 wifi passwords currently stored in memory (including the Brave diagnostics network), and the SSID that the Particle is currently connected to.

Note: You cannot create an event that publishes the current password being used, since the Particle OS does not provide that information. Only WiFi.SSID() is offered for security reasons.

**Event data:**

1. **myPasswords[0]** - string containing this password
2. **myPasswords[1]** - string containing this password
   Etc up to myPasswords[4]
3. **Connected to:** - string containing SSID the Particle WiFi module is currently connected to

### “Wifi Disconnect Warning”

**Event description:** If the Particle loses wifi connection, the firmware will call the connectToWifi() function, and this will increment through the five different stored wifi credentials until connection to one of them is successful.

If reconnection is successful this event will be published, warning that there was a disconnection and providing the length of the disconnection in seconds. If the Particle cannot reconnect obviously this event will not be published, but at this point you have bigger problems and this event can’t help you...

**Event data:**

1. Length of disconnect in seconds - integer number of seconds
