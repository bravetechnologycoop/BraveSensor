#define CATCH_CONFIG_MAIN
#include "base.h"
#include "../src/consoleFunctions.cpp"
#include "../src/consoleFunctions.h"
#include "../src/flashAddresses.h"
#include "../src/stateMachine.h"

IMDoorID globalDoorID = {0xAA, 0xAA, 0xAA};
uint8_t bleAntennaType;
unsigned long state3_stillness_timer;
bool hasDurationAlertBeenSent;
bool hasStillnessAlertBeenSent;

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

SCENARIO("Set Occupation Detection Timer", "[occupation detection timer]") {
    GIVEN("A starting occupation detection timer of 1 minute") {
        state0_occupant_detection_timer = 60000;

        WHEN("the function is called with 'e'") {
            int returnFlag = occupant_detection_timer_set("e");

            THEN("the initial timer value should remain the same") {
                REQUIRE(state0_occupant_detection_timer == 60000);
            }

            THEN("the function should return the stored value") {
                REQUIRE(returnFlag == 60);
            }
        }

        WHEN("the function is called with a positive integer") {
            int returnFlag = occupant_detection_timer_set("30");

            THEN("the initial timer value should be updated to the input * 1000") {
                REQUIRE(state0_occupant_detection_timer == 30000);
            }

            THEN("the function should return the input") {
                REQUIRE(returnFlag == 30);
            }
        }

        WHEN("the function is called with a negative integer") {
            int returnFlag = occupant_detection_timer_set("-30");

            THEN("the initial timer value should not be updated") {
                REQUIRE(state0_occupant_detection_timer == 60000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with something other than 'e' or a positive integer") {
            int returnFlag = occupant_detection_timer_set("nonInt");

            THEN("the initial timer value should not be updated") {
                REQUIRE(state0_occupant_detection_timer == 60000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }
    }
}

SCENARIO("Set Initial Timer", "[initial timer]") {
    GIVEN("A starting initial timer of 10 milliseconds") {
        state1_max_time = 10000;

        WHEN("the function is called with 'e'") {
            int returnFlag = initial_timer_set("e");

            THEN("the initial timer value should remain the same") {
                REQUIRE(state1_max_time == 10000);
            }

            THEN("the function should return the stored value") {
                REQUIRE(returnFlag == 10);
            }
        }

        WHEN("the function is called with a positive integer") {
            int returnFlag = initial_timer_set("15");

            THEN("the initial timer value should be updated to the input * 1000") {
                REQUIRE(state1_max_time == 15000);
            }

            THEN("the function should return the input") {
                REQUIRE(returnFlag == 15);
            }
        }

        WHEN("the function is called with a negative integer") {
            int returnFlag = initial_timer_set("-15");

            THEN("the initial timer value should not be updated") {
                REQUIRE(state1_max_time == 10000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with something other than 'e' or a positive integer") {
            int returnFlag = initial_timer_set("nonInt");

            THEN("the initial timer value should not be updated") {
                REQUIRE(state1_max_time == 10000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }
    }
}

SCENARIO("Set Duration Timer", "[duration timer]") {
    GIVEN("A starting initial timer of 10 milliseconds") {
        state2_max_duration = 10000;

        WHEN("the function is called with 'e'") {
            int returnFlag = duration_timer_set("e");

            THEN("the initial timer value should remain the same") {
                REQUIRE(state2_max_duration == 10000);
            }

            THEN("the function should return the stored value") {
                REQUIRE(returnFlag == 10);
            }
        }

        WHEN("the function is called with a positive integer") {
            int returnFlag = duration_timer_set("15");

            THEN("the initial timer value should be updated to the input * 1000") {
                REQUIRE(state2_max_duration == 15000);
            }

            THEN("the function should return the input") {
                REQUIRE(returnFlag == 15);
            }
        }

        WHEN("the function is called with a negative integer") {
            int returnFlag = duration_timer_set("-15");

            THEN("the initial timer value should not be updated") {
                REQUIRE(state2_max_duration == 10000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with something other than 'e' or a positive integer") {
            int returnFlag = duration_timer_set("nonint");

            THEN("the initial timer value should not be updated") {
                REQUIRE(state2_max_duration == 10000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }
    }
}

SCENARIO("Set Stillness Timer", "[stillness timer]") {
    GIVEN("A starting stillness timer of 10 milliseconds") {
        state3_max_stillness_time = 10000;

        WHEN("the function is called with 'e'") {
            int returnFlag = stillness_timer_set("e");

            THEN("the initial timer value should remain the same") {
                REQUIRE(state3_max_stillness_time == 10000);
            }

            THEN("the function should return the stored value") {
                REQUIRE(returnFlag == 10);
            }
        }

        WHEN("the function is called with a positive integer") {
            int returnFlag = stillness_timer_set("15");

            THEN("the initial timer value should be updated to the input * 1000") {
                REQUIRE(state3_max_stillness_time == 15000);
            }

            THEN("the function should return the input") {
                REQUIRE(returnFlag == 15);
            }
        }

        WHEN("the function is called with a negative integer") {
            int returnFlag = stillness_timer_set("-15");

            THEN("the initial timer value should not be updated") {
                REQUIRE(state3_max_stillness_time == 10000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with something other than 'e' or a positive integer") {
            int returnFlag = stillness_timer_set("nonint");

            THEN("the initial timer value should not be updated") {
                REQUIRE(state3_max_stillness_time == 10000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }
    }
}

SCENARIO("Set Long Stillness Timer", "[long stillness timer]") {
    GIVEN("A starting long stillness timer of 10 milliseconds") {
        state3_max_long_stillness_time = 10000;

        WHEN("the function is called with 'e'") {
            int returnFlag = long_stillness_timer_set("e");

            THEN("the initial timer value should remain the same") {
                REQUIRE(state3_max_long_stillness_time == 10000);
            }

            THEN("the function should return the stored value") {
                REQUIRE(returnFlag == 10);
            }
        }

        WHEN("the function is called with a positive integer") {
            int returnFlag = long_stillness_timer_set("15");

            THEN("the initial timer value should be updated to the input * 1000") {
                REQUIRE(state3_max_long_stillness_time == 15000);
            }

            THEN("the function should return the input") {
                REQUIRE(returnFlag == 15);
            }
        }

        WHEN("the function is called with a negative integer") {
            int returnFlag = long_stillness_timer_set("-15");

            THEN("the initial timer value should not be updated") {
                REQUIRE(state3_max_long_stillness_time == 10000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with something other than 'e' or a positive integer") {
            int returnFlag = long_stillness_timer_set("nonint");

            THEN("the initial timer value should not be updated") {
                REQUIRE(state3_max_long_stillness_time == 10000);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }
    }
}

SCENARIO("Set INS Threshold", "[ins threshold]") {
    GIVEN("A starting initial threshold of 10") {
        ins_threshold = 10;

        WHEN("the function is called with 'e'") {
            int returnFlag = ins_threshold_set("e");

            THEN("the initial timer value should remain the same") {
                REQUIRE(ins_threshold == 10);
            }

            THEN("the function should return the stored value") {
                REQUIRE(returnFlag == 10);
            }
        }

        WHEN("the function is called with a positive integer") {
            int returnFlag = ins_threshold_set("15");

            THEN("the initial timer value should be updated to the input") {
                REQUIRE(ins_threshold == 15);
            }

            THEN("the function should return the input") {
                REQUIRE(returnFlag == 15);
            }
        }

        WHEN("the function is called with a negative integer") {
            int returnFlag = ins_threshold_set("-15");

            THEN("the initial timer value should not be updated") {
                REQUIRE(ins_threshold == 10);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with something other than 'e' or a positive integer") {
            int returnFlag = ins_threshold_set("nonint");

            THEN("the initial timer value should not be updated") {
                REQUIRE(ins_threshold == 10);
            }

            THEN("the function should return -1 to indicate an error") {
                REQUIRE(returnFlag == -1);
            }
        }
    }
}

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

SCENARIO("Reset_Stillness_Timer_For_Alerting_Session", "[reset stillness timer for alerting session]") {
    GIVEN("A session that has already had a Duration Alert") {
        unsigned long initial_state3_stillness_timer_value = 30005;
        state3_stillness_timer = initial_state3_stillness_timer_value;
        hasDurationAlertBeenSent = true;
        hasStillnessAlertBeenSent = false;

        WHEN("the function is called with any string") {
            int returnVal = reset_stillness_timer_for_alerting_session("any string");

            THEN("The function should return the difference between old stillness timer value and now") {
                // Testing a one-second range to prevent test flakiness
                unsigned long expectedValue = millis() - initial_state3_stillness_timer_value;
                REQUIRE((returnVal >= expectedValue - 1000 && returnVal <= expectedValue));
            }

            THEN("The new stillness timer value is the current value of millis()") {
                // Testing a one-second range to prevent test flakiness
                int currentTimeInMillis = (int)millis();
                REQUIRE((state3_stillness_timer >= currentTimeInMillis - 1000 && state3_stillness_timer <= currentTimeInMillis));
            }
        }
    }

    GIVEN("A session that has already had a Stillness Alert") {
        unsigned long initial_state3_stillness_timer_value = 30005;
        state3_stillness_timer = initial_state3_stillness_timer_value;
        hasDurationAlertBeenSent = false;
        hasStillnessAlertBeenSent = true;

        WHEN("the function is called with any string") {
            int returnVal = reset_stillness_timer_for_alerting_session("any string");

            THEN("The function should return the difference between old stillness timer value and now") {
                // Testing a one-second range to prevent test flakiness
                unsigned long expectedValue = millis() - initial_state3_stillness_timer_value;
                REQUIRE((returnVal >= expectedValue - 1000 && returnVal <= expectedValue));
            }

            THEN("The new stillness timer value is the current value of millis()") {
                // Testing a one-second range to prevent test flakiness
                int currentTimeInMillis = (int)millis();
                REQUIRE((state3_stillness_timer >= currentTimeInMillis - 1000 && state3_stillness_timer <= currentTimeInMillis));
            }
        }
    }

    GIVEN("A session that has not yet sent any alerts") {
        unsigned long initial_state3_stillness_timer_value = 30005;
        state3_stillness_timer = initial_state3_stillness_timer_value;
        hasDurationAlertBeenSent = false;
        hasStillnessAlertBeenSent = false;

        WHEN("the function is called with any string") {
            int returnVal = reset_stillness_timer_for_alerting_session("any string");

            THEN("The function should return -1") {
                REQUIRE(returnVal == -1);
            }

            THEN("The stillness timer value did not change") {
                REQUIRE(state3_stillness_timer == initial_state3_stillness_timer_value);
            }
        }
    }
}

SCENARIO("Set BLE Antenna Type", "[ble antenna type]") {
    GIVEN("An internal antenna type") {
        bleAntennaType = 0;

        WHEN("the function is called with 'e'") {
            int returnFlag = toggle_ble_antenna("e");

            THEN("antenna type should remain the same") {
                REQUIRE(bleAntennaType == 0);
            }

            THEN("the function should return the stored value") {
                REQUIRE(returnFlag == 0);
            }
        }

        WHEN("the function is called with neither 1, 0 or e") {
            int returnFlag = toggle_ble_antenna("invalid value");

            THEN("antenna type should remain the same") {
                REQUIRE(bleAntennaType == 0);
            }

            THEN("the function should return -1") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with '0'") {
            int returnFlag = toggle_ble_antenna("0");

            THEN("antenna type should remain the same") {
                REQUIRE(bleAntennaType == 0);
            }

            THEN("the function should return 0") {
                REQUIRE(returnFlag == 0);
            }
        }

        WHEN("the functions is called with '1'") {
            int returnFlag = toggle_ble_antenna("1");

            THEN("antenna type should change to external") {
                REQUIRE(bleAntennaType == 1);
            }

            THEN("the function should return 1") {
                REQUIRE(returnFlag == 1);
            }
        }
    }

    GIVEN("An external antenna type") {
        bleAntennaType = 1;

        WHEN("the function is called with 'e'") {
            int returnFlag = toggle_ble_antenna("e");

            THEN("antenna type should remain the same") {
                REQUIRE(bleAntennaType == 1);
            }

            THEN("the function should return the stored value") {
                REQUIRE(returnFlag == 1);
            }
        }

        WHEN("the function is called with neither 1, 0 or e") {
            int returnFlag = toggle_ble_antenna("invalid value");

            THEN("antenna type should remain the same") {
                REQUIRE(bleAntennaType == 1);
            }

            THEN("the function should return -1") {
                REQUIRE(returnFlag == -1);
            }
        }

        WHEN("the function is called with '0'") {
            int returnFlag = toggle_ble_antenna("0");

            THEN("antenna type should change to internal") {
                REQUIRE(bleAntennaType == 0);
            }

            THEN("the function should return 0") {
                REQUIRE(returnFlag == 0);
            }
        }

        WHEN("the function is called with '1'") {
            int returnFlag = toggle_ble_antenna("1");

            THEN("antenna type should remain the same") {
                REQUIRE(bleAntennaType == 1);
            }

            THEN("the function should return 1") {
                REQUIRE(returnFlag == 1);
            }
        }
    }
}