/*
 * Brave firmware state machine for single Boron
 * written by Heidi Fedorak, Apr 2021
*/

#include "Particle.h"
#include "ins3331.h"
#include <CircularBuffer.h>

os_queue_t insQueue;

//setup function & subfunctions
void setupINS3331(){

	// Create a queue. Each element is an unsigned char, there are 25 elements. Last parameter is always 0.
	os_queue_create(&insQueue, sizeof(rawINSData), 128, 0);
	// Create the thread
	new Thread("readINSThread", threadINSReader);  

}

//in the future, checkINS3331() will become a thread
filteredINSData checkINS3331(){

  rawINSData dataToParse;
  static CircularBuffer<int,MOVING_AVERAGE_BUFFER_SIZE> iBuffer, qBuffer;
  static float iSum = 0;
  static float qSum = 0;
  static filteredINSData returnINSData = {0,0,0};

  //os_queue_take returns 0 on success, so if we get a value, dump it to circular buffer
  if (os_queue_take(insQueue, &dataToParse, 0, 0) == 0) {

    //add absolute values to circular buffer for the rolling average
    //since push() adds to the tail, adding beyond capacity causes the element at head to be overwritten and lost
    iBuffer.push(abs(dataToParse.inPhase));
    qBuffer.push(abs(dataToParse.quadrature));

    //compute average of the first n data points by computing the full sum
    if(iBuffer.size() == MOVING_AVERAGE_SAMPLE_SIZE){

      for (int i = 0; i < MOVING_AVERAGE_SAMPLE_SIZE; i++) {
        iSum += iBuffer[i];
        qSum += qBuffer[i];
      }
      returnINSData.iAverage = iSum/MOVING_AVERAGE_SAMPLE_SIZE;
      returnINSData.qAverage = qSum/MOVING_AVERAGE_SAMPLE_SIZE;
  
    }

    //compute subsequent averages by using sum = sum - oldVal + newVal
    //note buffer size must be at least one greater than sample size to retain oldVal
    if(iBuffer.size() == MOVING_AVERAGE_BUFFER_SIZE){

      /*for (int i = 0; i < MOVING_AVERAGE_BUFFER_SIZE; i++) {
        Log.info("iBuf[%d], qBuf[%d]: %d,   %d", i,i,iBuffer[i],qBuffer[i]);
      }
      */
      iSum = iSum - iBuffer[0] + iBuffer[MOVING_AVERAGE_BUFFER_SIZE-1];
      qSum = qSum - qBuffer[0] + qBuffer[MOVING_AVERAGE_BUFFER_SIZE-1];
      returnINSData.iAverage = iSum/MOVING_AVERAGE_SAMPLE_SIZE;
      returnINSData.qAverage = qSum/MOVING_AVERAGE_SAMPLE_SIZE;
      //record the time this value was removed from the queue and calculated
      returnINSData.timestamp = millis();
      //Log.info("iAverage = %f, qAverage = %f", returnINSData.iAverage, returnINSData.qAverage); 
    } 

  } //end queue if

  return returnINSData;

} //end checkINS3331()


//*********************************threads***************************************
void threadINSReader(void *param) {

  static signed char receiveBuffer[14];
  static int receiveBufferIndex;
  signed char iHighByte;
  signed char iLowByte;
  signed char qHighByte;
  signed char qLowByte;

  rawINSData rawData;

  while(true){

    if(SerialRadar.available())
    {

      unsigned char c = SerialRadar.read();

      if(c == START_DELIMITER) receiveBufferIndex = 0;

      receiveBuffer[receiveBufferIndex] = c;

      receiveBufferIndex++;

      //Log.info("receiveBufferIndex = %d", receiveBufferIndex);

      //if c = frame end deliminator = 0x16, frame has completed transmission 
      //so break and put the raw I and Q bytes in a queue
      if(c == END_DELIMITER) {

        //extract i and q in byte form
        iHighByte = receiveBuffer[7];
        iLowByte = receiveBuffer[8];
        qHighByte = receiveBuffer[9];
        qLowByte = receiveBuffer[10];

/*        Log.info("iHigh = 0x%02X", receiveBuffer[7]);
        Log.info("iLow = 0x%02X", receiveBuffer[8]);
        Log.info("qHigh = 0x%02X", receiveBuffer[9]);
        Log.info("qLow = 0x%02X", receiveBuffer[10]);
*/
        //convert bytes to signed integer
        rawData.inPhase = (int)(iHighByte << 8 | iLowByte);
        rawData.quadrature = (int)(qHighByte << 8 | qLowByte);
        
        os_queue_put(insQueue, (void *)&rawData, 0, 0);

        //print to log
        //Log.info("iINS: %d", rawData.inPhase);
        //Log.info("qINS, %d", rawData.quadrature);

      }//end frame delimter if

    } //end radar available if

    os_thread_yield();

  } //end thread while



} //end threadINSReader


//loop() functions and sub-functions 
void startINSSerial(){

	SerialRadar.begin(38400, SERIAL_8N1);
  writeToINS3331(APPLICATION_STOP);
  //give module time to stop sending data
  delay(100);
  writeToINS3331(APPLICATION_START);

}


void writeToINS3331(unsigned char function_code){

  unsigned char ins3331_send_buf[15] = {WAKEUP_BYTE, START_DELIMITER, 0x80, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, END_DELIMITER};
  ins3331_send_buf[4] = function_code;

  //calculate checksum for a 15-byte array (writing to INS always requires 15 byte array)
  unsigned char checksum = calculateChecksum(ins3331_send_buf, 15); 
  //load checksum into array for writing
  ins3331_send_buf[13] = checksum;

  for(int i = 0; i < 15; i++){
    Log.info("frame written to INS3331: send_buf[%d] = 0x%02X", i, ins3331_send_buf[i]);
  }
  //write!
  SerialRadar.write(ins3331_send_buf, 15);  

}

unsigned char calculateChecksum(unsigned char myArray[], int arrayLength){

  unsigned char checksum = 0x00;

  switch(arrayLength){
    case 14:
      for(int i = 1; i <= 11; i++){
        checksum = checksum + myArray[i];
      }
    case 15:
      for(int i = 2; i <= 12; i++){
        checksum = checksum + myArray[i];
      }
  } //end switch

  return checksum;

}