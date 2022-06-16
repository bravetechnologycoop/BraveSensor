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


//in the future, checkSMPIR() will become a thread
float checkSMPIR(){
  //Serial.printlnf("AS: %f", pirAverage);
  return pirAverage;
} //end checkSMPIR()

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
