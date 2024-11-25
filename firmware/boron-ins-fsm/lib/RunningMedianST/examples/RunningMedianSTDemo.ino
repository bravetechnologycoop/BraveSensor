/*
 * Project RunningMedianST
 * Description: Running median demo for floats and int32_t
 * Author: Robert Mawrey
 * Date: 10/24/2019
 */

#include "RunningMedianST.h"

// Based on work by:
//    FILE: RunningMedian.ino
//  AUTHOR: Rob Tillaart ( kudos to Sembazuru)
// VERSION: 0.1.01
// PURPOSE: demo
//    DATE: 2013-10-17
//     URL:
//
// Released to the public domain
//



RunningMedianFloat floatSamples = RunningMedianFloat(5);
RunningMedianInt32 int32Samples = RunningMedianInt32(5);

void setup()
{
  Serial.begin(115200);
  Serial.print("Running Median Sentient Things Version: ");
  Serial.println(RUNNING_MEDIAN_VERSION);
}

void loop()
{
  int32_t x = (int32_t)analogRead(A0);
  float y = (float)x;

  floatSamples.add(y);
  int32Samples.add(x);

  Serial.print(millis());
  Serial.print("\t");
  Serial.print(floatSamples.getMedian());
  Serial.print("\t");
  Serial.println(int32Samples.getMedian());
  
  delay(100);
}
