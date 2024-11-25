//
// ORIGINAL AUTHOR: Rob dot Tillaart at gmail dot com
// PURPOSE: RunningMedian library for Particle
// VERSION: 0.1.15
//     URL: http://arduino.cc/playground/Main/RunningMedian
// HISTORY: See RunningMedian.cpp
//
// Released to the public domain
//
// Modified by Robert Mawrey for integer and float values and for 16 bit array index (memory permitting)

#ifndef RunningMedianST_h
#define RunningMedianST_h

#include "application.h"

#include <inttypes.h>

#define RUNNING_MEDIAN_VERSION "0.0.1"

// should at least be 5 to be practical
// odd size results in a 'real' middle element.
// even size takes the lower of the two middle elements
#ifndef MEDIAN_MIN_SIZE
#define MEDIAN_MIN_SIZE     1
#endif
#ifndef MEDIAN_MAX_SIZE
#define MEDIAN_MAX_SIZE     99          // adjust if needed
#endif

#define NAN NULL



class RunningMedianFloat
{
protected:
  boolean _sorted;
  uint16_t _size;
  uint16_t _cnt;
  uint16_t _idx;
  float _ar[MEDIAN_MAX_SIZE];
  uint16_t _p[MEDIAN_MAX_SIZE];

  void sort();

public:
  explicit RunningMedianFloat(const uint16_t size);  // # elements in the internal buffer
  ~RunningMedianFloat();                            // destructor

  void clear();                        // resets internal buffer and var
  void add(const float value);        // adds a new value to internal buffer, optionally replacing the oldest element.
  float getMedian();                  // returns the median == middle element

};

class RunningMedianInt32
{
protected:
  boolean _sorted;
  uint16_t _size;
  uint16_t _cnt;
  uint16_t _idx;
  float _ar[MEDIAN_MAX_SIZE];
  uint16_t _p[MEDIAN_MAX_SIZE];

  void sort();

public:
  explicit RunningMedianInt32(const uint16_t size);  // # elements in the internal buffer
  ~RunningMedianInt32();                            // destructor

  void clear();                        // resets internal buffer and var
  void add(const int32_t value);        // adds a new value to internal buffer, optionally replacing the oldest element.
  int32_t getMedian();                  // returns the median == middle element

};

#endif




// END OF FILE
