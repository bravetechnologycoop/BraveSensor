#include "Particle.h"
#include "smpir.h"

int pirAPin = A0;
float pirAverage = 0;

//setup function & subfunctions
void setupSMPIR(){

  pinMode(pirAPin, INPUT);
  Serial.begin(9600);
  new Thread("readPIRThread", threadPIRReader);  
}

//DEBUG THIS AND DATASHEET
//ACTUALLY UNDERSTAND SENSOR


//in the future, checkSMPIR() will become a thread
float checkSMPIR(){
  Serial.printlnf("Analog: %ld   Digital: %ld", analogRead(pirAPin), digitalRead(pirAPin));

  return pirAverage;
} //end checkSMPIR()


//USE MILLIS INSTEAD
void threadPIRReader(){
  while(true){
    pirAverage = ((MOVING_AVERAGE_SAMPLE_SIZE-1)*pirAverage + analogRead(pirAPin))/MOVING_AVERAGE_SAMPLE_SIZE; 
    delay(100);
  }
}



//loop() functions and sub-functions 
void startPIRSerial(){
  //Serial.print(" AS: ");
  //Serial.println(analogRead(pirAPin)); //0 to 4095
}
