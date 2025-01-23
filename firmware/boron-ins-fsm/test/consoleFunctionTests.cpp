/* consoleFunctionTests.cpp - Unit tests for console functions
 *
 * Copyright (C) 2024 Brave Technology Coop. All rights reserved.
 */

#define CATCH_CONFIG_MAIN
#include "base.h"
#include "../src/consoleFunctions.cpp"
#include "../src/consoleFunctions.h"
#include "../src/flashAddresses.h"
#include "../src/stateMachine.h"

// Mock variable for globalDoorID
IMDoorID globalDoorID = {0xAA, 0xAA, 0xAA};

SCENARIO("Force_Reset", "[force reset]") {
    GIVEN("Any possible scenario") {
        resetWasCalled = false;
        fullPublishString = "";
        WHEN("the function is called with 1") {
            int returnVal = force_reset("1");

            THEN("returnValue should be 1 and resetWasCalled should be true") {
                REQUIRE(returnVal == 1);
                REQUIRE(resetWasCalled == true);
                REQUIRE(fullPublishString ==
                        "YOU SHALL NOT PANIC!!Reset has begun so ignore the future particle message about failure to call force_reset()");
            }
        }

        WHEN("the function is not called with 1") {
            int returnVal = force_reset("invalid Value");

            THEN("the return value should be -1 and resetWasCalled should be false") {
                REQUIRE(returnVal == -1);
                REQUIRE(resetWasCalled == false);
            }
        }
    }
}

SCENARIO("Reset State to Zero", "[reset state to zero]") {
    GIVEN("The state handler is set to a non-zero state") {
        stateHandler = state1_initial_countdown;

        WHEN("the function is called with '1'") {
            int returnFlag = reset_state_to_zero("1");

            THEN("the state handler should be reset to state0_idle") {
                REQUIRE(stateHandler == state0_idle);
            }

            THEN("the function should return 1 to indicate success") {
                REQUIRE(returnFlag == 1);
            }
        }

        WHEN("the function is called with something other than '1'") {
            int returnFlag = reset_state_to_zero("0");

            THEN("the state handler should not be changed") {
                REQUIRE(stateHandler == state1_initial_countdown);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with a string longer than 1 character") {
            int returnFlag = reset_state_to_zero("invalid");

            THEN("the state handler should not be changed") {
                REQUIRE(stateHandler == state1_initial_countdown);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }
    }
}

SCENARIO("Turn_Debugging_Publishes_On_Off", "[toggle debug flag]") {
    GIVEN("A false debug flag") {
        stateMachineDebugFlag = false;

        WHEN("the function is called with 1") {
            int returnVal = toggle_debugging_publishes("1");

            THEN("debug flag should be set to true") {
                REQUIRE(stateMachineDebugFlag == true);
            }

            THEN("return value should be 1") {
                REQUIRE(returnVal == 1);
            }
        }

        WHEN("the function is called with 0") {
            int returnVal = toggle_debugging_publishes("0");

            THEN("debug flag should remain false") {
                REQUIRE(stateMachineDebugFlag == false);
            }

            THEN("return value should be 0") {
                REQUIRE(returnVal == 0);
            }
        }

        WHEN("the function is called with neither 0 nor 1") {
            int returnVal = toggle_debugging_publishes("invalid Value");

            THEN("debug flag should remain false") {
                REQUIRE(stateMachineDebugFlag == false);
            }

            THEN("the return value should be -1") {
                REQUIRE(returnVal == -1);
            }
        }

        WHEN("The function is called with 'e'") {
            int returnVal = toggle_debugging_publishes("e");

            THEN("The function should return whether debugging publishes are turned on, in this case, false") {
                REQUIRE(returnVal == 0);
            }
        }
    }

    GIVEN("A true debug flag") {
        stateMachineDebugFlag = true;

        WHEN("the function is called with 1") {
            int returnVal = toggle_debugging_publishes("1");

            THEN("debug flag should be true") {
                REQUIRE(stateMachineDebugFlag == true);
            }

            THEN("return value should be 1") {
                REQUIRE(returnVal == 1);
            }
        }

        WHEN("the function is called with 0") {
            int returnVal = toggle_debugging_publishes("0");

            THEN("debug flag should be false") {
                REQUIRE(stateMachineDebugFlag == false);
            }

            THEN("return value should be 0") {
                REQUIRE(returnVal == 0);
            }
        }

        WHEN("the function is called with something other than 0 or 1") {
            int returnVal = toggle_debugging_publishes("invalidValue");

            THEN("debug flag should remain true") {
                REQUIRE(stateMachineDebugFlag == true);
            }

            THEN("the return value should be -1") {
                REQUIRE(returnVal == -1);
            }
        }

        WHEN("The function is called with 'e'") {
            int returnVal = toggle_debugging_publishes("e");

            THEN("The function should return whether debugging publishes are turned on, in this case, true") {
                REQUIRE(returnVal == 1);
            }
        }
    }
}

SCENARIO("Set Occupancy Detection INS Threshold", "[occupancy detection threshold]") {
    GIVEN("A starting initial threshold of 10") {
        occupancy_detection_ins_threshold = 10;

        WHEN("the function is called with 'e'") {
            int returnFlag = occupancy_detection_ins_threshold_set("e");

            THEN("the initial time value should remain the same") {
                REQUIRE(occupancy_detection_ins_threshold == 10);
            }

            THEN("the function should return the stored value") {
                REQUIRE(occupancy_detection_ins_threshold == 10);
            }
        }

        WHEN("the function is called with a positive integer") {
            int returnFlag = occupancy_detection_ins_threshold_set("15");

            THEN("the initial time value should be updated to the input") {
                REQUIRE(occupancy_detection_ins_threshold == 15);
            }

            THEN("the function should return the input") {
                REQUIRE(occupancy_detection_ins_threshold == 15);
            }
        }

        WHEN("the function is called with a negative integer") {
            int returnFlag = occupancy_detection_ins_threshold_set("-15");

            THEN("the initial time value should not be updated") {
                REQUIRE(occupancy_detection_ins_threshold == 10);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with something other than 'e' or a positive integer") {
            int returnFlag = occupancy_detection_ins_threshold_set("nonint");

            THEN("the initial time value should not be updated") {
                REQUIRE(occupancy_detection_ins_threshold == 10);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }
    }
}

SCENARIO("Set Stillness INS Threshold", "[stillness threshold]") {
    GIVEN("A starting initial threshold of 10") {
        stillness_ins_threshold = 10;

        WHEN("the function is called with 'e'") {
            int returnFlag = stillness_ins_threshold_set("e");

            THEN("the initial time value should remain the same") {
                REQUIRE(stillness_ins_threshold == 10);
            }

            THEN("the function should return the stored value") {
                REQUIRE(returnFlag == 10);
            }
        }

        WHEN("the function is called with a positive integer") {
            int returnFlag = stillness_ins_threshold_set("15");

            THEN("the initial time value should be updated to the input") {
                REQUIRE(stillness_ins_threshold == 15);
            }

            THEN("the function should return the input") {
                REQUIRE(returnFlag == 15);
            }
        }

        WHEN("the function is called with a negative integer") {
            int returnFlag = stillness_ins_threshold_set("-15");

            THEN("the initial time value should not be updated") {
                REQUIRE(stillness_ins_threshold == 10);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with something other than 'e' or a positive integer") {
            int returnFlag = stillness_ins_threshold_set("nonint");

            THEN("the initial time value should not be updated") {
                REQUIRE(stillness_ins_threshold == 10);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }
    }
}

SCENARIO("Set State 0 Occupancy Detection Time", "[state 0 occupancy detection time]") {
    GIVEN("A starting occupancy detection time of 1 minute") {
        state0_occupancy_detection_time = 60000;

        WHEN("the function is called with 'e'") {
            int returnFlag = occupancy_detection_time_set("e");

            THEN("the initial time value should remain the same") {
                REQUIRE(state0_occupancy_detection_time == 60000);
            }

            THEN("the function should return the stored value") {
                REQUIRE(returnFlag == 60);
            }
        }

        WHEN("the function is called with a positive integer") {
            int returnFlag = occupancy_detection_time_set("30");

            THEN("the initial time value should be updated to the input * 1000") {
                REQUIRE(state0_occupancy_detection_time == 30000);
            }

            THEN("the function should return the input") {
                REQUIRE(returnFlag == 30);
            }
        }

        WHEN("the function is called with a negative integer") {
            int returnFlag = occupancy_detection_time_set("-30");

            THEN("the initial time value should not be updated") {
                REQUIRE(state0_occupancy_detection_time == 60000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with something other than 'e' or a positive integer") {
            int returnFlag = occupancy_detection_time_set("nonInt");

            THEN("the initial time value should not be updated") {
                REQUIRE(state0_occupancy_detection_time == 60000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }
    }
}

SCENARIO("Set State 1 Initial Time", "[state 1 initial time]") {
    GIVEN("A starting initial time of 10 milliseconds") {
        state1_initial_time = 10000;

        WHEN("the function is called with 'e'") {
            int returnFlag = initial_time_set("e");

            THEN("the initial time value should remain the same") {
                REQUIRE(state1_initial_time == 10000);
            }

            THEN("the function should return the stored value") {
                REQUIRE(returnFlag == 10);
            }
        }

        WHEN("the function is called with a positive integer") {
            int returnFlag = initial_time_set("15");

            THEN("the initial time value should be updated to the input * 1000") {
                REQUIRE(state1_initial_time == 15000);
            }

            THEN("the function should return the input") {
                REQUIRE(returnFlag == 15);
            }
        }

        WHEN("the function is called with a negative integer") {
            int returnFlag = initial_time_set("-15");

            THEN("the initial time value should not be updated") {
                REQUIRE(state1_initial_time == 10000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with something other than 'e' or a positive integer") {
            int returnFlag = initial_time_set("nonInt");

            THEN("the initial time value should not be updated") {
                REQUIRE(state1_initial_time == 10000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }
    }
}

SCENARIO("Set Duration Alert Time", "[duration alert time]") {
    GIVEN("A starting duration time of 20 minutes") {
        duration_alert_time = 1200000;

        WHEN("the function is called with 'e'") {
            int returnFlag = duration_alert_time_set("e");

            THEN("the duration alert time value should remain the same") {
                REQUIRE(duration_alert_time == 1200000);
            }

            THEN("the function should return the stored value in seconds") {
                REQUIRE(returnFlag == 1200);
            }
        }

        WHEN("the function is called with a positive integer") {
            int returnFlag = duration_alert_time_set("15");

            THEN("the duration alert time value should be updated to the input * 1000") {
                REQUIRE(duration_alert_time == 15000);
            }

            THEN("the function should return the input in seconds") {
                REQUIRE(returnFlag == 15);
            }
        }

        WHEN("the function is called with a negative integer") {
            int returnFlag = duration_alert_time_set("-15");

            THEN("the duration alert time value should not be updated") {
                REQUIRE(duration_alert_time == 1200000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with something other than 'e' or a positive integer") {
            int returnFlag = duration_alert_time_set("nonInt");

            THEN("the duration alert time value should not be updated") {
                REQUIRE(duration_alert_time == 1200000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }
    }
}

SCENARIO("Set Initial Stillness Alert Time", "[initial stillness alert time]") {
    GIVEN("A starting initial stillness alert time of 5 minutes") {
        initial_stillness_alert_time = 300000;

        WHEN("the function is called with 'e'") {
            int returnFlag = initial_stillness_alert_time_set("e");

            THEN("the initial stillness alert time value should remain the same") {
                REQUIRE(initial_stillness_alert_time == 300000);
            }

            THEN("the function should return the stored value in seconds") {
                REQUIRE(returnFlag == 300);
            }
        }

        WHEN("the function is called with a positive integer") {
            int returnFlag = initial_stillness_alert_time_set("10");

            THEN("the initial stillness alert time value should be updated to the input * 1000") {
                REQUIRE(initial_stillness_alert_time == 10000);
            }

            THEN("the function should return the input in seconds") {
                REQUIRE(returnFlag == 10);
            }
        }

        WHEN("the function is called with a negative integer") {
            int returnFlag = initial_stillness_alert_time_set("-10");

            THEN("the initial stillness alert time value should not be updated") {
                REQUIRE(initial_stillness_alert_time == 300000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with something other than 'e' or a positive integer") {
            int returnFlag = initial_stillness_alert_time_set("nonInt");

            THEN("the initial stillness alert time value should not be updated") {
                REQUIRE(initial_stillness_alert_time == 300000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }
    }
}

SCENARIO("Set Followup Stillness Alert Time", "[followup stillness alert time]") {
    GIVEN("A starting followup stillness alert time of 3 minutes") {
        followup_stillness_alert_time = 180000;

        WHEN("the function is called with 'e'") {
            int returnFlag = followup_stillness_alert_time_set("e");

            THEN("the followup stillness alert time value should remain the same") {
                REQUIRE(followup_stillness_alert_time == 180000);
            }

            THEN("the function should return the stored value in seconds") {
                REQUIRE(returnFlag == 180);
            }
        }

        WHEN("the function is called with a positive integer") {
            int returnFlag = followup_stillness_alert_time_set("20");

            THEN("the followup stillness alert time value should be updated to the input * 1000") {
                REQUIRE(followup_stillness_alert_time == 20000);
            }

            THEN("the function should return the input in seconds") {
                REQUIRE(returnFlag == 20);
            }
        }

        WHEN("the function is called with a negative integer") {
            int returnFlag = followup_stillness_alert_time_set("-20");

            THEN("the followup stillness alert time value should not be updated") {
                REQUIRE(followup_stillness_alert_time == 180000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with something other than 'e' or a positive integer") {
            int returnFlag = followup_stillness_alert_time_set("nonInt");

            THEN("the followup stillness alert time value should not be updated") {
                REQUIRE(followup_stillness_alert_time == 180000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }
    }
}


SCENARIO("Change_IM21_Door_ID", "[change door id]") {
    GIVEN("A valid global door ID") {
        String doorID = "AB,CD,EF";

        WHEN("the function is called with a valid door ID") {
            int returnVal = im21_door_id_set(doorID);

            THEN("The function should return the door ID converted to a decimal number") {
                REQUIRE(returnVal == 11259375);
            }
        }

        WHEN("The function is called with e and a valid door ID was previously set") {
            im21_door_id_set("12,34,56");
            int returnVal = im21_door_id_set("e");  // Note: The mock EEPROM is coded to always return 0x123456 as the door ID

            THEN("The function should return the current value of the door ID, converted to a decimal number") {
                REQUIRE(returnVal == 1193046);
            }
        }

        WHEN("the function is called with an empty string") {
            int returnVal = im21_door_id_set("");

            THEN("the function should return -1 for the invalid input") {
                REQUIRE(returnVal == -1);
            }
        }

        WHEN("the function is called with a missing byte") {
            int returnVal = im21_door_id_set("GH,IJ");

            THEN("the function should return -1 for the invalid input") {
                REQUIRE(returnVal == -1);
            }
        }
    }
}
