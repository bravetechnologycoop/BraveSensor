#define CATCH_CONFIG_MAIN
#include "base.h"
#include "../src/consoleFunctions.cpp"
#include "../src/consoleFunctions.h"
#include "../src/flashAddresses.h"

SCENARIO( "Turn_Debugging_Publishes_On_Off", "[debugging]" ) {

    GIVEN( "A false debug flag" ) {
        stateMachineDebugFlag = false;

        WHEN( "the function is called with 1" ) {
            toggle_debugging_publishes("1");

            THEN( "debug flag should be set to true" ) {
                REQUIRE( stateMachineDebugFlag == true );
            }
        }

        WHEN( "the function is called with 0" ) {
            toggle_debugging_publishes("0");

            THEN( "debug flag should remain false" ) {
                REQUIRE( stateMachineDebugFlag == false );
            }
        }

        WHEN( "the function is called with neither 0 nor 1" ) {
            int returnVal = toggle_debugging_publishes("invalid Value");

            THEN( "debug flag should remain false" ) {
                REQUIRE( stateMachineDebugFlag == false );
            }

            THEN( "the return value should be -1" ) {
                REQUIRE( returnVal == -1 );
            }

        }
    }
        GIVEN( "A true debug flag" ) {
        stateMachineDebugFlag = true;

        WHEN( "the function is called with 1" ) {
            toggle_debugging_publishes("1");

            THEN( "debug flag should be true" ) {
                REQUIRE( stateMachineDebugFlag == true );
            }
        }

        WHEN( "the function is called with 0" ) {
            toggle_debugging_publishes("0");

            THEN( "debug flag should be false" ) {
                REQUIRE( stateMachineDebugFlag == false );
            }
        }

        WHEN( "the function is called with something other than 0 or 1" ) {
            int returnVal = toggle_debugging_publishes("invalidValue");

            THEN( "debug flag should remain true" ) {
                REQUIRE( stateMachineDebugFlag == true );
            }

            THEN( "the return value should be -1" ) {
                REQUIRE( returnVal == -1 );
            }

        }

    }

}

SCENARIO( "Change_IM21_Door_ID", "[setting door id]" ) {

    GIVEN( "A false debug flag" ) {
        stateMachineDebugFlag = false;

        WHEN( "the function is called with 1" ) {
            toggle_debugging_publishes("1");

            THEN( "debug flag should be set to true" ) {
                REQUIRE( stateMachineDebugFlag == true );
            }
        }

        WHEN( "the function is called with 0" ) {
            toggle_debugging_publishes("0");

            THEN( "debug flag should remain false" ) {
                REQUIRE( stateMachineDebugFlag == false );
            }
        }

        WHEN( "the function is called with neither 0 nor 1" ) {
            int returnVal = toggle_debugging_publishes("invalid Value");

            THEN( "debug flag should remain false" ) {
                REQUIRE( stateMachineDebugFlag == false );
            }

            THEN( "the return value should be -1" ) {
                REQUIRE( returnVal == -1 );
            }

        }
    }
        GIVEN( "A true debug flag" ) {
        stateMachineDebugFlag = true;

        WHEN( "the function is called with 1" ) {
            toggle_debugging_publishes("1");

            THEN( "debug flag should be true" ) {
                REQUIRE( stateMachineDebugFlag == true );
            }
        }

        WHEN( "the function is called with 0" ) {
            toggle_debugging_publishes("0");

            THEN( "debug flag should be false" ) {
                REQUIRE( stateMachineDebugFlag == false );
            }
        }

        WHEN( "the function is called with something other than 0 or 1" ) {
            int returnVal = toggle_debugging_publishes("invalidValue");

            THEN( "debug flag should remain true" ) {
                REQUIRE( stateMachineDebugFlag == true );
            }

            THEN( "the return value should be -1" ) {
                REQUIRE( returnVal == -1 );
            }

        }

    }

}
