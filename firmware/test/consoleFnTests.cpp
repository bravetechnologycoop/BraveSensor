#include "base.h"
#include "../../src/consoleFunctions.cpp"

  Particle.function("Change_Initial_Timer", initial_timer_set); 
  Particle.function("Change_Duration_Timer", duration_timer_set);     
  Particle.function("Change_Stillness_Timer", stillness_timer_set);  
  Particle.function("Change_INS_Threshold", ins_threshold_set);
  Particle.function("Turn_Debugging_Publishes_On_Off", toggle_debugging_publishes);   
  Particle.function("Change_IM21_Door_ID", im21_door_id_set); 

SCENARIO("Console Functions", "[consoleFnTests]")
{
    GIVEN("An initial timer value of 0")
    {
        WHEN("initial_timer_Set is called with a value")
        initial_timer_set("100");

    }
}